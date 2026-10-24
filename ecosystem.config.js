module.exports = {
  apps: [
    {
      name: 'klaretail-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--dns-result-order=ipv4first',
      },
    },
  ],
};
