/// <reference types="next" />
/// <reference types="next/types/global" />
/// <reference types="next/image-types/global" />

// @types/node@20.x
// @types/react@18.x
// @types/react-dom@18.x

// Extend ProcessEnv interface in NodeJS namespace
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_API_URL: string;
    NEXT_PUBLIC_WS_URL: string;
    NODE_ENV: 'development' | 'production' | 'test';
  }
}

// Extend JSX namespace
declare namespace JSX {
  interface Element extends React.ReactElement {}
  interface ElementClass extends React.Component<any> {}
  interface ElementAttributesProperty { props: {}; }
  interface ElementChildrenAttribute { children: {}; }
}

// Next.js API types
interface NextApiRequest {
  body: any;
  query: {
    [key: string]: string | string[];
  };
  cookies: {
    [key: string]: string;
  };
}

interface NextApiResponse {
  status(code: number): NextApiResponse;
  json(data: any): void;
  send(data: any): void;
}

// Next.js Page type
interface NextPage<P = {}, IP = P> {
  getInitialProps?(context: any): Promise<IP> | IP;
  getServerSideProps?(context: any): Promise<{ props: P }>;
  getStaticProps?(context: any): Promise<{ props: P }>;
}