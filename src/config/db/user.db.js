import mongoose from "mongoose";
let userDB;

export const connectUserDB = async () => {
  if (!userDB) {
    userDB = await mongoose.createConnection(process.env.USER_DB_URI);
    console.log("User DB connected");
  }
  return userDB;
};