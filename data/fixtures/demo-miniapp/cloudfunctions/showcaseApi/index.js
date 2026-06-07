const routes = require("./route");

exports.main = async function main(event, context) {
  const route = event.route || "";
  const handler = routes[route];
  if (!handler) return { ok: false, code: "ROUTE_NOT_FOUND" };
  return handler(event, context);
};
