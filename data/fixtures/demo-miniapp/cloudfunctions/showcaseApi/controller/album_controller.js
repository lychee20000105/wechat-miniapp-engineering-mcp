const albumService = require("../service/album_service");

exports.list = async function list(params, context) {
  if (!context || !context.OPENID) return { ok: false, code: "LOGIN_REQUIRED" };
  return albumService.listAuthorizedAlbums(params, context.OPENID);
};
