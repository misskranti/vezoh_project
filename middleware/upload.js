const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = "vezoh/drivers";
    return {
      folder,
      allowed_formats: ["jpg", "jpeg", "png", "pdf"],
      public_id: `${file.fieldname}-${Date.now()}`,
    };
  },
});

// Multer instance
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Upload fields
const driverDocuments = upload.fields([
  { name: "drivingLicense", maxCount: 1 },
  { name: "rcCertificate", maxCount: 1 },
  { name: "vehicleInsurance", maxCount: 1 },
]);

// Error handling middleware
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let message = "File upload error";
    
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        message = "File too large. Maximum size is 5MB per file.";
        break;
      case "LIMIT_FILE_COUNT":
        message = "Too many files uploaded.";
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message = "Unexpected field. Please upload only the required documents.";
        break;
      default:
        message = err.message;
    }
    
    return res.status(400).json({ success: false, message });
  }
  
  if (err && err.message.includes("Invalid file type")) {
    return res.status(400).json({ success: false, message: err.message });
  }
  
  next(err);
};

module.exports = {
  driverDocuments,
  handleUploadErrors,
  upload,
};
