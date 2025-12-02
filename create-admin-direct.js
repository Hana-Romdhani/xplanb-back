// Direct MongoDB Admin Creation Script
// Run this in MongoDB shell or MongoDB Compass

// First, let's check if the admin user exists
print("Checking for existing admin user...");
var existingAdmin = db.users.findOne({ email: "admin@xplanb.com" });

if (existingAdmin) {
    print("✅ Admin user already exists!");
    print("📧 Email: " + existingAdmin.email);
    print("👤 Role: " + existingAdmin.accountType);
    print("🆔 User ID: " + existingAdmin._id);
} else {
    print("Creating new admin user...");
    
    // Create admin user with hashed password (Admin123!)
    var adminUser = {
        firstName: "Admin",
        lastName: "User",
        email: "admin@xplanb.com",
        password: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // Admin123!
        accountType: ["ADMIN"],
        gender: "Male",
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    
    var result = db.users.insertOne(adminUser);
    
    if (result.insertedId) {
        print("✅ Admin user created successfully!");
        print("📧 Email: admin@xplanb.com");
        print("🔑 Password: Admin123!");
        print("👤 Role: ADMIN");
        print("🆔 User ID: " + result.insertedId);
    } else {
        print("❌ Failed to create admin user");
    }
}

print("\n🎯 Admin Features Available:");
print("   ✅ View all user complaints");
print("   ✅ Update complaint status");
print("   ✅ Access system-wide analytics");
print("   ✅ Monitor user activity logs");
print("   ✅ Manage user permissions");

print("\n🌐 Login at: http://localhost:3000");
