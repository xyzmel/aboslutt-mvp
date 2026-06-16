import bcrypt from "bcryptjs";

const saltRounds = 12;

export function validatePassword(password: string) {
  return password.length >= 8;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, saltRounds);
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}
