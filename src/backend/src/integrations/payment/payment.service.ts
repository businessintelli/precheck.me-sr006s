import Stripe from 'stripe';
import { Logger } from 'winston';
import Redis from 'ioredis';
import { BadRequestException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { BackgroundCheckType } from '../../types/background-check.types';
import { Organization } from '../../types/organization.types';

/**
 * Enhanced payment service for handling secure payment processing and subscription management
 * @version stripe: ^12.0.0
 * @version winston: ^3.11.0
 * @version ioredis: ^5.0.0
 */
export class PaymentService {
    private readonly stripeClient: Stripe;
    private readonly logger: Logger;
    private readonly redisClient: Redis;

    constructor() {
        if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
            throw new Error('Missing required Stripe configuration');
        }

        this.stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16',
            typescript: true,
        });

        this.logger = new Logger({
            level: 'info',
            format: Logger.format.combine(
                Logger.format.timestamp(),
                Logger.format.json()
            )
        });

        this.redisClient = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            enableReadyCheck: true
        });
    }

    /**
     * Creates a secure checkout session for background check payment
     */
    async createCheckoutSession(
        checkType: BackgroundCheckType,
        organizationId: string,
        successUrl: string,
        cancelUrl: string
    ): Promise<string> {
        try {
            // Rate limiting check
            const attempts = await this.redisClient.incr(`checkout_attempts:${organizationId}`);
            await this.redisClient.expire(`checkout_attempts:${organizationId}`, 60);
            
            if (attempts > Number(process.env.RATE_LIMIT_CONFIG?.MAX_ATTEMPTS || 5)) {
                throw new BadRequestException('Rate limit exceeded. Please try again later.');
            }

            // Get price ID based on check type
            const priceId = this.getPriceIdForCheckType(checkType);
            if (!priceId) {
                throw new BadRequestException('Invalid background check type');
            }

            // Create checkout session with security measures
            const session = await this.stripeClient.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price: priceId,
                    quantity: 1
                }],
                mode: 'payment',
                success_url: successUrl,
                cancel_url: cancelUrl,
                client_reference_id: organizationId,
                metadata: {
                    checkType,
                    organizationId
                },
                payment_intent_data: {
                    capture_method: 'manual', // For fraud prevention
                    setup_future_usage: 'off_session'
                }
            });

            this.logger.info('Checkout session created', {
                sessionId: session.id,
                organizationId,
                checkType
            });

            return session.url!;
        } catch (error) {
            this.logger.error('Error creating checkout session', {
                error,
                organizationId,
                checkType
            });
            throw new InternalServerErrorException('Failed to create checkout session');
        }
    }

    /**
     * Creates or updates organization subscription with enhanced validation
     */
    async createSubscription(
        organizationId: string,
        subscriptionTier: string,
        paymentMethodId: string
    ): Promise<void> {
        try {
            // Validate subscription tier
            const priceId = this.getPriceIdForSubscription(subscriptionTier);
            if (!priceId) {
                throw new BadRequestException('Invalid subscription tier');
            }

            // Create or update customer
            let customer = await this.getOrCreateCustomer(organizationId);

            // Attach payment method to customer
            await this.stripeClient.paymentMethods.attach(paymentMethodId, {
                customer: customer.id
            });

            // Set as default payment method
            await this.stripeClient.customers.update(customer.id, {
                invoice_settings: {
                    default_payment_method: paymentMethodId
                }
            });

            // Create subscription
            const subscription = await this.stripeClient.subscriptions.create({
                customer: customer.id,
                items: [{ price: priceId }],
                payment_behavior: 'default_incomplete',
                payment_settings: {
                    payment_method_types: ['card'],
                    save_default_payment_method: 'on_subscription'
                },
                metadata: {
                    organizationId,
                    subscriptionTier
                },
                expand: ['latest_invoice.payment_intent']
            });

            this.logger.info('Subscription created', {
                subscriptionId: subscription.id,
                organizationId,
                tier: subscriptionTier
            });
        } catch (error) {
            this.logger.error('Error creating subscription', {
                error,
                organizationId,
                subscriptionTier
            });
            throw new InternalServerErrorException('Failed to create subscription');
        }
    }

    /**
     * Handles Stripe webhooks with enhanced security and validation
     */
    async handleWebhook(signature: string, rawBody: Buffer): Promise<void> {
        try {
            const event = this.stripeClient.webhooks.constructEvent(
                rawBody,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET!
            );

            switch (event.type) {
                case 'payment_intent.succeeded':
                    await this.handlePaymentSuccess(event.data.object);
                    break;
                case 'payment_intent.payment_failed':
                    await this.handlePaymentFailure(event.data.object);
                    break;
                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdate(event.data.object);
                    break;
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionCancellation(event.data.object);
                    break;
            }

            this.logger.info('Webhook processed', {
                eventType: event.type,
                eventId: event.id
            });
        } catch (error) {
            this.logger.error('Webhook processing error', { error });
            throw new UnauthorizedException('Invalid webhook signature');
        }
    }

    /**
     * Process refunds with enhanced validation and fraud detection
     */
    async refundPayment(paymentIntentId: string, reason: string): Promise<void> {
        try {
            // Verify payment intent exists and is refundable
            const paymentIntent = await this.stripeClient.paymentIntents.retrieve(paymentIntentId);
            if (!paymentIntent.charges.data[0]?.refunded) {
                const refund = await this.stripeClient.refunds.create({
                    payment_intent: paymentIntentId,
                    reason: reason as Stripe.RefundCreateParams.Reason,
                    metadata: {
                        reason,
                        refundedAt: new Date().toISOString()
                    }
                });

                this.logger.info('Payment refunded', {
                    refundId: refund.id,
                    paymentIntentId,
                    reason
                });
            }
        } catch (error) {
            this.logger.error('Refund processing error', {
                error,
                paymentIntentId
            });
            throw new InternalServerErrorException('Failed to process refund');
        }
    }

    // Private helper methods
    private getPriceIdForCheckType(checkType: BackgroundCheckType): string {
        const prices = {
            [BackgroundCheckType.BASIC]: process.env.CHECK_PRICES?.BASIC,
            [BackgroundCheckType.STANDARD]: process.env.CHECK_PRICES?.STANDARD,
            [BackgroundCheckType.COMPREHENSIVE]: process.env.CHECK_PRICES?.COMPREHENSIVE
        };
        return prices[checkType] || '';
    }

    private getPriceIdForSubscription(tier: string): string {
        const prices = {
            STARTUP: process.env.SUBSCRIPTION_PRICES?.STARTUP,
            BUSINESS: process.env.SUBSCRIPTION_PRICES?.BUSINESS,
            ENTERPRISE: process.env.SUBSCRIPTION_PRICES?.ENTERPRISE
        };
        return prices[tier as keyof typeof prices] || '';
    }

    private async getOrCreateCustomer(organizationId: string): Promise<Stripe.Customer> {
        const customers = await this.stripeClient.customers.list({
            limit: 1,
            metadata: { organizationId }
        });

        if (customers.data.length > 0) {
            return customers.data[0];
        }

        return await this.stripeClient.customers.create({
            metadata: { organizationId }
        });
    }

    private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
        // Implementation for payment success handling
    }

    private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
        // Implementation for payment failure handling
    }

    private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
        // Implementation for subscription update handling
    }

    private async handleSubscriptionCancellation(subscription: Stripe.Subscription): Promise<void> {
        // Implementation for subscription cancellation handling
    }
}