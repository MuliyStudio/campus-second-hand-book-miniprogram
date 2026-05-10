// components/emoji-panel/emoji-panel.js
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
      observer: function(newVal) {
        if (newVal) {
          this.showPanel();
        } else {
          this.hidePanel();
        }
      }
    }
  },

  data: {
    allEmojis: [
      '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊',
      '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '🙂', '🤗',
      '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥',
      '😮', '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜',
      '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️',
      '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨',
      '😩', '🤯', '😬', '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵',
      '😠', '😡', '🤬', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '😇',
      '🤠', '🤡', '🥳', '🥺', '🤥', '🤫', '🤭', '🧐', '🤓', '😈',
      '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾'
    ],
    showPanel: false
  },

  methods: {
    showPanel: function() {
      this.setData({ showPanel: true });
    },

    hidePanel: function() {
      this.setData({ showPanel: false });
    },

    onEmojiTap: function(e) {
      const emoji = e.currentTarget.dataset.emoji;
      this.triggerEvent('select', { emoji });
    },

    onDeleteEmoji: function() {
      this.triggerEvent('delete');
    },

    onClose: function() {
      this.triggerEvent('close');
    }
  }
});