const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const writeFileAsync = promisify(fs.writeFile);

// This function generates a PDF file from the waiver data
async function generatePdf({ playerName, activityType, signatureData, outputPath }) {
	// Generate the HTML content for the PDF
	const htmlContent = generateWaiverHtml(playerName, activityType, signatureData);
	
	try {
		// For a real implementation, you would use a library like puppeteer, html-pdf, or pdf-lib
		// to convert the HTML content into a PDF file
		
		// For demonstration, we'll save the HTML file since it would then be converted to PDF
		// In a real implementation, replace this with actual PDF generation
		await writeFileAsync(outputPath, htmlContent);
		
		console.log(`PDF generation placeholder created at: ${outputPath}`);
		return outputPath;
	} catch (error) {
		console.error("Error generating PDF:", error);
		throw error;
	}
}

function generateWaiverHtml(playerName, activityType, signatureData) {
	const activityLabel = activityType === "laser-tag" ? "Laser Tag" : "Escape Room";
	const date = new Date().toLocaleDateString();
	
	return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Waiver for ${playerName}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      max-width: 200px;
      margin-bottom: 20px;
    }
    h1 {
      color: #1e40af;
      margin-bottom: 5px;
    }
    .document-title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 20px;
    }
    .section {
      margin-bottom: 30px;
    }
    .signature-container {
      margin-top: 50px;
      border-top: 1px solid #ccc;
      padding-top: 20px;
    }
    .signature-image {
      max-width: 300px;
      margin-bottom: 10px;
    }
    .signature-date {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
    }
    .field {
      margin-bottom: 10px;
    }
    .field-label {
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>COMPANY NAME</h1>
    <p>123 Entertainment Avenue, City, State ZIP</p>
  </div>
  
  <div class="document-title">
    LIABILITY WAIVER AND RELEASE FORM - ${activityLabel.toUpperCase()}
  </div>
  
  <div class="section">
    <p>I, <strong>${playerName}</strong>, understand that participation in ${activityLabel} activities involves inherent risks of injury or damage to myself or others.</p>
    
    <p>By signing this waiver, I acknowledge these risks and agree to:</p>
    
    <ol>
      <li>Follow all safety instructions provided by staff</li>
      <li>Use all equipment properly and as directed</li>
      <li>Accept full responsibility for my actions during the activity</li>
      <li>Pay for any damages I cause to equipment or facilities</li>
    </ol>
    
    <p>I hereby release COMPANY NAME, its employees, and representatives from any liability for injuries, damages, or losses that may occur during my participation.</p>
  </div>
  
  <div class="section">
    <p>I understand that COMPANY NAME reserves the right to remove any participant from the activity for unsafe behavior without refund. I also grant permission to use my likeness in photographs or videos for promotional purposes without compensation.</p>
  </div>
  
  <div class="signature-container">
    <div class="field">
      <div class="field-label">Participant Signature:</div>
      <img src="${signatureData}" class="signature-image" alt="Signature" />
    </div>
    
    <div class="signature-date">
      <div class="field">
        <div class="field-label">Participant Name:</div>
        <div>${playerName}</div>
      </div>
      
      <div class="field">
        <div class="field-label">Date:</div>
        <div>${date}</div>
      </div>
    </div>
  </div>
  
  <div class="footer" style="margin-top: 50px; font-size: 10px; color: #666; text-align: center;">
    <p>This document was electronically signed and is legally binding according to Electronic Signatures in Global and National Commerce Act (E-Sign).</p>
  </div>
</body>
</html>
  `;
}

module.exports = {
	generatePdf
};
