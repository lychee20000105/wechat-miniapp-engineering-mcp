const db = wx.cloud.database();

exports.findByOwner = function findByOwner(openid) {
  return db.collection("client_album_demo").where({
    ownerOpenid: openid,
    revoked: false
  }).get();
};
