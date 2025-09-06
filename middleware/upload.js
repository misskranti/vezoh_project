const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../uploads/drivers");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// File filter - allow only images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg", 
    "image/jpg",
    "image/png", 
    "application/pdf",
  ];
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf"];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, and PDF files are allowed."), false);
  }
};

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 3, // Max 3 files
  },
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
        message = "Too many files. Maximum 3 files allowed.";
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message = "Unexpected field. Please upload only the required documents.";
        break;
      default:
        message = err.message;
    }
    
    return res.status(400).json({ 
      success: false, 
      message,
    });
  }
  
  if (err && err.message.includes("Invalid file type")) {
    return res.status(400).json({ 
      success: false, 
      message: err.message,
    });
  }
  
  next(err);
};

//cleanup uploaded files if something fails
const cleanupFiles = (files) => {
  if (!files) return;
  Object.values(files).forEach((fileArr) => {
    fileArr.forEach((file) => {
      fs.unlink(file.path, () => {});
    });
  });
};

module.exports = {
  upload,
  driverDocuments,
  handleUploadErrors,
  cleanupFiles,
};
