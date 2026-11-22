import type { NextConfig } from "next";
import path from "node:path";
const nextConfig:NextConfig={
  poweredByHeader:false,
  webpack(config){if(process.env.OZEAR_RUNTIME==="vercel")config.resolve.alias[path.resolve(process.cwd(),"lib/service.ts")]=path.resolve(process.cwd(),"lib/gateway-client.ts");return config;},
  async headers(){return [{source:"/:path*",headers:[{key:"Content-Security-Policy",value:"default-src 'self'; script-src 'self' 'unsafe-inline'"+(process.env.NODE_ENV==="development"?" 'unsafe-eval'":"")+"; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'"+(process.env.NODE_ENV==="development"?" ws: wss:":"")+"; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"},{key:"X-Content-Type-Options",value:"nosniff"},{key:"Referrer-Policy",value:"same-origin"},{key:"X-Frame-Options",value:"DENY"}]}];},
};
export default nextConfig;
