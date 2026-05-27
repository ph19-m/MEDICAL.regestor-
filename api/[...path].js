const { handleApi } = require("../server/server");

module.exports = async function handler(request, response) {
  const host = request.headers.host || "localhost";
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const url = new URL(request.url || "/", `${protocol}://${host}`);

  if (!url.pathname.startsWith("/api/")) {
    url.pathname = `/api${url.pathname.startsWith("/") ? "" : "/"}${url.pathname}`;
  }

  return handleApi(request, response, url);
};
