// MongoDB script to create admin user
// Run this in MongoDB shell or MongoDB Compass

// First, create the admin user (if not exists)
db.users.insertOne({
  firstName: "Admin",
  lastName: "User", 
  email: "admin@xplanb.com",
  password: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // Admin123!
  accountType: ["ADMIN"],
  gender: ["Male"],
  createdAt: new Date(),
  updatedAt: new Date(),
  twoFactorEnabled: false
});

// Or if user already exists, update their role
db.users.updateOne(
  { email: "admin@xplanb.com" },
  { 
    $set: { 
      accountType: ["ADMIN"],
      updatedAt: new Date()
    } 
  }
);

// Verify the admin user was created/updated
db.users.findOne({ email: "admin@xplanb.com" });
