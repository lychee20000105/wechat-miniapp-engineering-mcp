const app = getApp();

Page({
  data: {
    title: "Demo showcase",
    demoMode: app.globalData.demoMode
  },
  onLoad() {
    wx.cloud.callFunction({
      name: "showcaseApi",
      data: {
        route: "album/list"
      }
    });
  },
  handleOpenAlbum() {
    wx.navigateTo({
      url: "/pages/album/detail?id=demo"
    });
  }
});
