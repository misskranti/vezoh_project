const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const addressSchema = new mongoose.Schema(
  {
    addressId: {
      type: String,
      required: true,
      default: () => uuidv4(), 
    },
    label: {
      type: String,
      required: true,
    },
    street: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    postalCode: {
      type: String,
      required: true,
    },
    coordinates: {
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    phonenumber: {
      type: String,
      required: true,
      unique: true,
      match: /^[0-9]{10,15}$/,
      index: true,
    },
    emailaddress: {
      type: String,
      unique: true,
      sparse: true,
      match: /^\S+@\S+\.\S+$/,
      index: true,
    },
    fullname: {
      type: String,
      required: true,
      index: true,
    },
    avatarUrl: {
      type: String,
    },
    role: {
      type: String,
      enum: ["user", "driver"],
      default: "user",
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    addresses: [addressSchema],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    lastLogin: {
      type: Date,
    },
    preferences: {
      notifications: {
        type: Boolean,
        default: true,
      },
      preferredPaymentMethod: {
        type: String,
      },
    },
  },
  { timestamps: true }
);

userSchema.index({ phonenumber: 1, emailaddress: 1 });

userSchema.index(
  { "addresses.addressId": 1 },
  { 
    unique: true, 
    sparse: true,
    partialFilterExpression: { 
      "addresses.addressId": { $exists: true, $ne: null } 
    }
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
