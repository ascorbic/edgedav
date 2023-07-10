// deno-lint-ignore-file require-await
import { Config } from "https://edge.netlify.com/";

export default async function handler(request: Request): Promise<Response | void> {
  const { method, url } = request;
  console.log({ method, url });
  switch (request.method) {
    case "OPTIONS":
      return handleOptions(request);
    case "PROPFIND":
      return handlePropfind(request);
    case "LOCK":
      return handleLock(request);
    case "UNLOCK":
      return handleUnlock(request);
    case "GET":
      // handled by the static site
      return;
    default:
      return new Response("Method Not Allowed", { status: 405 });
  }
}

async function handleOptions(request: Request): Promise<Response> {
  const headers = new Headers();
  headers.set("Allow", "OPTIONS, DELETE, LOCK, UNLOCK, GET");
  headers.set("DAV", "1,2");
  return new Response(null, { status: 200, headers: headers });
}

async function handleLock(request: Request): Promise<Response> {
  const headers = new Headers();
  headers.set("Lock-Token", "<opaquelocktoken:1234567890>");
  const body = '<?xml version="1.0" encoding="utf-8" ?>' +
    '<D:prop xmlns:D="DAV:">' +
    "<D:lockdiscovery>" +
    "<D:activelock>" +
    "<D:locktoken><D:href>opaquelocktoken:1234567890</D:href></D:locktoken>" +
    "</D:activelock>" +
    "</D:lockdiscovery>" +
    "</D:prop>";
  return new Response(body, { status: 200, headers: headers });
}

async function handleUnlock(request: Request): Promise<Response> {
  return new Response(null, { status: 204 });
}

function propfindResponseXML(
  filename: string,
  content: string,
  isCollection: boolean,
): string {
  const encoder = new TextEncoder();
  const contentLength = encoder.encode(content).length;
  return '<?xml version="1.0" encoding="utf-8" ?>' +
    '<D:multistatus xmlns:D="DAV:">' +
    (isCollection
      ? "<D:response>" +
        "<D:href>/</D:href>" +
        "<D:propstat>" +
        "<D:prop>" +
        "<D:resourcetype><D:collection/></D:resourcetype>" +
        "</D:prop>" +
        "<D:status>HTTP/1.1 200 OK</D:status>" +
        "</D:propstat>" +
        "</D:response>"
      : "") +
    "<D:response>" +
    `<D:href>/${filename}</D:href>` +
    "<D:propstat>" +
    "<D:prop>" +
    "<D:resourcetype/>" +
    `<D:getcontentlength>${contentLength}</D:getcontentlength>` +
    "<D:getcontenttype>text/plain</D:getcontenttype>" +
    "</D:prop>" +
    "<D:status>HTTP/1.1 200 OK</D:status>" +
    "</D:propstat>" +
    "</D:response>" +
    "</D:multistatus>";
}

async function handlePropfind(request: Request): Promise<Response> {
  const headers = new Headers();

  const path = new URL(request.url).pathname;

  headers.set("Content-Type", "application/xml");

  switch (path) {
    case "/": {
      const body = propfindResponseXML("readme.txt", "hello world", true);
      return new Response(body, { status: 207, headers: headers });
    }
    case "/readme.txt": {
      const body = propfindResponseXML("readme.txt", "hello world", false);
      return new Response(body, { status: 207, headers: headers });
    }
    default:
      // return a 404 Not Found for any other path
      return new Response("Not Found", { status: 404 });
  }
}

export const config: Config = {
  path: ["/", "/readme.txt"],
};
