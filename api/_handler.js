const { handleApi } = require("../server/server");

module.exports = function proxyToAppApi(request, response) {
  const host = request.headers.host || "localhost";
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const url = new URL(request.url || "/", `${protocol}://${host}`);

  return handleApi(request, response, url);
};
