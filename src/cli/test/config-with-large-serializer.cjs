module.exports = {
  dialect: 'sqlite',
  logLevel: 'silent',
  print: true,
  serializer: {
    serializeFile() {
      return 'x'.repeat(2_000_000);
    },
  },
  url: ':memory:',
};
