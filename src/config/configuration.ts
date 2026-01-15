export default () => ({
  nodeEnv: process.env.NODE_ENV,
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
    refreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 604800),
  },

  security: {
    bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 12),
  },
});
