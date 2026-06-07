const albumModel = require("../model/album_model");

exports.listAuthorizedAlbums = async function listAuthorizedAlbums(params, openid) {
  return albumModel.findByOwner(openid);
};
