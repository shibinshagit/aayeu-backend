// src/services/userService.js
const {
  addAddress,
} = require("../controllers/userController/userAuthController");
const dbPool = require("../db/dbConnection");
const queries = require("../dbQueries/dbQueries");
const googleAuth = require("../utils/googleAuth");

module.exports.UserServices = {
  async findUserByGoogleSub(googleSub, client) {
    const q = `SELECT * FROM users WHERE google_sub = $1 LIMIT 1`;
    const { rows } = await client.query(q, [googleSub]);
    return rows[0] || null;
  },

  findUserByEmail: async (email, client = dbPool) => {
    const { rows } = await client.query(queries.findUserByEmail, [email]);
    return rows[0];
  },

  findUserById: async (id, client = dbPool) => {
    const { rows } = await client.query(queries.findUserById, [id]);
    return rows[0];
  },

  createUser: async (
    { full_name, email, phone, provider, google_sub },
    client = dbPool
  ) => {
    const { rows } = await client.query(queries.insertUser, [
      full_name,
      email,
      phone,
      provider,
      google_sub,
    ]);
    return rows[0];
  },

  updateUser: async (
    { id, full_name, phone, dob, gender },
    client = dbPool
  ) => {
    const { rows } = await client.query(queries.updateUserProfile, [
      full_name,
      phone,
      dob,
      gender,
      id,
    ]);
    return rows[0];
  },

  updateUserMagicToken: async (
    { userId, token, expiresAt },
    client = dbPool
  ) => {
    const { rows } = await client.query(queries.updateUserMagicToken, [
      token,
      expiresAt,
      userId,
    ]);
    return rows[0];
  },

  findUserWithAddress: async (id, client = dbPool) => {
    const { rows } = await client.query(queries.findUserWithAddress, [id]);
    return rows[0];
  },

  addAddress: async (
    { userId, line1, line2, city, state, zip, country },
    client = dbPool
  ) => {
    const { rows } = await client.query(queries.insertAddress, [
      userId,
      line1,
      line2,
      city,
      state,
      zip,
      country,
    ]);
    return rows[0];
  },

  async loginWithGoogle({ code }, client) {
    // 1) exchange code -> tokens (access_token + id_token)
    const tokenRes = await googleAuth.exchangeCodeForTokens(code);
    const accessToken = tokenRes.access_token;

    if (!accessToken)
      throw new Error("Failed to obtain access token from Google");

    // 2) fetch userinfo
    const profile = await googleAuth.getUserInfo(accessToken);
    // profile has: sub, email, name, picture, email_verified, etc.

    if (!profile || !profile.sub)
      throw new Error("Failed to fetch Google profile");

    // 3) find or create user in DB
    let user = await this.findUserByGoogleSub(profile.sub, client);

    if (!user) {
      // If email already exists, attach google_sub (optional logic)
      const byEmail = profile.email
        ? await this.findUserByEmail(profile.email, client)
        : null;
      if (byEmail) {
        // attach google_sub to existing account
        const updateQ = `UPDATE users SET google_sub = $1, provider = 'google', updated_at = NOW() WHERE id = $2 RETURNING *`;
        const { rows } = await client.query(updateQ, [profile.sub, byEmail.id]);
        user = rows[0];
      } else {
        let userData = {
          full_name: profile.name,
          email: profile.email,
          phone: "",
          provider: "google",
          google_sub: profile.sub,
        };
        user = await this.createUser(userData, client);
      }
    } else {
      // update basic info if changed
      let userData = {
        id: user.id,
        full_name: user.full_name,
        phone: user.phone,
        dob: user.dob,
        gender: user.gender,
      };
      user = await this.updateUser(userData, client);
    }

    // 4) return user object
    return user;
  },
};
