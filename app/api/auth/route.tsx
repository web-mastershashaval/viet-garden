// app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { queryWithRetry } from "../../db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  console.log("🔐 Login request received");

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      console.log("❌ Missing username or password");
      return NextResponse.json(
        { message: "Username and password are required" },
        { status: 400 }
      );
    }

    console.log("🧍 Checking user:", username);

    // Fetch user
    const [rows]: any = await queryWithRetry(
      "SELECT id, name, username, email, role, password FROM admins WHERE username = ? LIMIT 1",
      [username]
    );

    if (!rows || rows.length === 0) {
      console.log("❌ User not found");
      return NextResponse.json(
        { message: "Invalid username or password" },
        { status: 401 }
      );
    }

    const admin = rows[0];
    console.log("👤 User found:", admin.username);

    // Compare passwords
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      console.log("❌ Incorrect password");
      return NextResponse.json(
        { message: "Invalid username or password" },
        { status: 401 }
      );
    }

    console.log("🔑 Password match, generating JWT…");

    // Validate JWT secret
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("❌ JWT_SECRET missing in env variables!");
      return NextResponse.json(
        { message: "Server configuration error" },
        { status: 500 }
      );
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
      secret,
      { expiresIn: "1h" }
    );

    console.log("🎫 Token generated successfully");

    // Prepare response
    const res = NextResponse.json({
      message: "Login successful",
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
    });

    // Set cookie
    res.cookies.set("adminToken", token, {
      httpOnly: true, // secure auth
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3600,
      path: "/",
    });

    console.log("🍪 Cookie set successfully");
    console.log("✅ Login complete");

    return res;
  } catch (error: any) {
    console.error("❌ Login API error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    return NextResponse.json(
      { message: "Server error occurred" },
      { status: 500 }
    );
  }
}
