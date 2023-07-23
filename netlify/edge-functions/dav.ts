// deno-lint-ignore-file require-await
import { Config, Context } from "https://deploy-preview-243--edge.netlify.app";

const ONE_GIG = 1024 * 1024 * 1024; // 1GB in bytes
export default async function handler(
  request: Request,
  context: Context,
): Promise<Response | void> {
  const { method, url } = request;
  let start = Date.now();
  console.log(
    await context.blobs?.get("dav2").catch((e: unknown) => console.error('failed to get', e)),
  );
  console.log("get", Date.now() - start);
  start = Date.now();
  await context.blobs?.set("dav2", new Date().toISOString());
  console.log("set", Date.now() - start);
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
    case "GET": {
      return handleGet(request);
    }
    case "PUT":
      return handlePut(request);

    default:
      return new Response("Method Not Allowed", { status: 405 });
  }
}

function handleGet(request: Request) {
  console.log("GET Headers: ", request.headers);
  const path = new URL(request.url).pathname;
  if (path === "/") {
    return;
  }
  if (path !== "/readme.txt") {
    return new Response("Not Found", { status: 404 });
  }
}

async function handlePut(request: Request): Promise<Response> {
  console.log("PUT Headers: ", request.headers);
  const path = new URL(request.url).pathname;
  if (!path.endsWith(".ts") && !path.endsWith(".m3u8")) {
    // method not allowed
    return new Response(null, { status: 405 });
  }

  // Assuming successful operation
  // For real operation, you would need to write the file and handle possible failures
  return new Response(null, { status: 201 });
}

async function handleOptions(request: Request): Promise<Response> {
  const headers = new Headers();
  headers.set("Allow", "OPTIONS, DELETE, LOCK, UNLOCK, GET, PUT, PROPFIND");
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

interface DavResponseObject {
  filename: string;
  contentLength?: number;
  contentType?: string;
  collection?: boolean;
  quotaAvailableBytes?: number;
}

function generateResponseXml(
  {
    filename,
    contentLength,
    contentType,
    collection,
    quotaAvailableBytes = ONE_GIG,
  }: DavResponseObject,
): string {
  return `<D:response>
    <D:href>/${filename}</D:href>
    <D:propstat>
      <D:prop>
        ${
    contentLength
      ? `<D:getcontentlength>${contentLength}</D:getcontentlength>`
      : ""
  }
        ${
    contentType ? `<D:getcontenttype>${contentType}</D:getcontenttype>` : ""
  }
        <D:quota-available-bytes>${quotaAvailableBytes}</D:quota-available-bytes>
        ${
    collection
      ? "<D:resourcetype><D:collection/></D:resourcetype>"
      : "<D:resourcetype/>"
  }
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
}

function generateMultiResponseXml(
  davResponseObjects: DavResponseObject[],
): string {
  return `<?xml version="1.0" encoding="utf-8" ?>
  <D:multistatus xmlns:D="DAV:">
    ${davResponseObjects.map(generateResponseXml).join("")}
  </D:multistatus>`;
}

const files: Record<string, DavResponseObject> = {
  "/": {
    filename: "/",
    collection: true,
  },
  "/readme.txt": {
    filename: "readme.txt",
    contentLength: 11,
    contentType: "text/plain",
  },
  "/.metadata_never_index_unless_rootfs": {
    filename: ".metadata_never_index_unless_rootfs",
  },
};

async function handlePropfind(request: Request): Promise<Response> {
  const headers = new Headers();

  const path = new URL(request.url).pathname;

  headers.set("Content-Type", "application/xml");

  if (path === "/") {
    const responseXml = generateMultiResponseXml(Object.values(files));
    return new Response(responseXml, { status: 207, headers });
  }
  const file = files[path];
  if (!file) {
    return new Response("Not Found", { status: 404 });
  }
  const responseXml = generateMultiResponseXml([file]);
  return new Response(responseXml, { status: 207, headers });
}

export const config: Config = {
  path: "/*",
};
