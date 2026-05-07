let io = null;

module.exports = {
  setSocketIO: (socketIO) => { io = socketIO; },
  getSocketIO: () => io
};