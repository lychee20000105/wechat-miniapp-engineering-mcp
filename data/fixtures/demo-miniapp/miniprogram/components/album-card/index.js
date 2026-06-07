Component({
  properties: {
    title: String
  },
  methods: {
    handleTap() {
      this.triggerEvent("open");
    }
  }
});
