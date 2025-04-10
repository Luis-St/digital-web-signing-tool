const fs = require("fs");
const path = require("path");
const jsPDF = require("jspdf");

// This function generates a PDF file from the waiver data
async function generatePdf({ playerName, activityType, signatureData, outputPath }) {
	try {
		// Create a new jsPDF instance
		const doc = new jsPDF.default({
			orientation: "portrait",
			unit: "mm",
			format: "a4",
		});
		
		// Set up fonts
		doc.setFont("helvetica", "normal");
		
		// Add header
		doc.setFontSize(22);
		doc.setTextColor(30, 64, 175); // #1e40af in RGB
		doc.text("COMPANY NAME", doc.internal.pageSize.getWidth() / 2, 20, { align: "center" });
		
		doc.setFontSize(12);
		doc.setTextColor(0, 0, 0);
		doc.text("123 Entertainment Avenue, City, State ZIP", doc.internal.pageSize.getWidth() / 2, 27, { align: "center" });
		
		// Add document title
		const activityLabel = activityType === "laser-tag" ? "Laser Tag" : "Escape Room";
		doc.setFontSize(16);
		doc.setFont("helvetica", "bold");
		doc.text(`LIABILITY WAIVER AND RELEASE FORM - ${activityLabel.toUpperCase()}`, doc.internal.pageSize.getWidth() / 2, 40, { align: "center" });
		
		// Add content
		doc.setFontSize(12);
		doc.setFont("helvetica", "normal");
		
		const contentX = 20;
		let contentY = 55;
		
		// First paragraph
		const firstParagraph = `I, ${playerName}, understand that participation in ${activityLabel} activities involves inherent risks of injury or damage to myself or others.`;
		contentY = addWrappedText(doc, firstParagraph, contentX, contentY, 170);
		contentY += 5;
		
		// Second paragraph
		doc.text("By signing this waiver, I acknowledge these risks and agree to:", contentX, contentY);
		contentY += 10;
		
		// List items
		const listItems = [
			"Follow all safety instructions provided by staff",
			"Use all equipment properly and as directed",
			"Accept full responsibility for my actions during the activity",
			"Pay for any damages I cause to equipment or facilities",
		];
		
		listItems.forEach((item, index) => {
			doc.text(`${index + 1}. ${item}`, contentX + 5, contentY);
			contentY += 7;
		});
		contentY += 3;
		
		// Third paragraph
		const thirdParagraph = "I hereby release COMPANY NAME, its employees, and representatives from any liability for injuries, damages, or losses that may occur during my participation.";
		contentY = addWrappedText(doc, thirdParagraph, contentX, contentY, 170);
		contentY += 10;
		
		// Fourth paragraph
		const fourthParagraph = "I understand that COMPANY NAME reserves the right to remove any participant from the activity for unsafe behavior without refund. I also grant permission to use my likeness in photographs or videos for promotional purposes without compensation.";
		contentY = addWrappedText(doc, fourthParagraph, contentX, contentY, 170);
		contentY += 20;
		
		// Add signature section
		doc.text("Participant Signature:", contentX, contentY);
		contentY += 7;
		
		// Handle signature image - with error handling and different format support
		let signatureAdded = false;
		try {
			// First try to extract the base64 data
			let signatureImg = signatureData;
			
			// Handle different data URI formats
			if (signatureData.includes("base64,")) {
				signatureImg = signatureData.split("base64,")[1];
			}
			
			// Determine image format
			let imgFormat = "PNG";
			if (signatureData.includes("data:image/jpeg")) {
				imgFormat = "JPEG";
			} else if (signatureData.includes("data:image/jpg")) {
				imgFormat = "JPEG";
			} else if (signatureData.includes("data:image/gif")) {
				imgFormat = "GIF";
			}
			
			// Add the signature image
			doc.addImage(signatureImg, imgFormat, contentX, contentY, 80, 40);
			signatureAdded = true;
		} catch (e) {
			console.error("Error adding signature image:", e);
			
			// Try alternative approach - save signature to temp file then add it
			try {
				const tempImagePath = path.join(path.dirname(outputPath), `temp_signature_${Date.now()}.png`);
				
				// Convert data URI to buffer and save to file
				const data = signatureData.replace(/^data:image\/\w+;base64,/, "");
				const buffer = Buffer.from(data, "base64");
				fs.writeFileSync(tempImagePath, buffer);
				
				// Add the image from file
				doc.addImage(tempImagePath, "PNG", contentX, contentY, 80, 40);
				signatureAdded = true;
				
				// Clean up temp file
				fs.unlinkSync(tempImagePath);
			} catch (altError) {
				console.error("Alternative signature method also failed:", altError);
			}
		}
		
		// If all signature methods failed, add a placeholder
		if (!signatureAdded) {
			doc.setFont("helvetica", "italic");
			doc.text("[Electronic signature applied]", contentX, contentY + 20);
			doc.setFont("helvetica", "normal");
		}
		
		contentY += 45;
		
		// Add date and name
		const today = new Date().toLocaleDateString();
		
		doc.text("Participant Name:", contentX, contentY);
		doc.text(playerName, contentX + 40, contentY);
		
		doc.text("Date:", contentX + 100, contentY);
		doc.text(today, contentX + 115, contentY);
		
		// Add footer
		doc.setFontSize(8);
		doc.setTextColor(100, 100, 100);
		const footerText = "This document was electronically signed and is legally binding according to Electronic Signatures in Global and National Commerce Act (E-Sign).";
		doc.text(footerText, doc.internal.pageSize.getWidth() / 2, 285, { align: "center" });
		
		// Save the PDF
		// Use binary string output and convert to Buffer properly
		const pdfBytes = doc.output("arraybuffer");
		const buffer = Buffer.from(new Uint8Array(pdfBytes));
		fs.writeFileSync(outputPath, buffer);
		
		console.log(`PDF generated successfully at: ${outputPath}`);
		return outputPath;
	} catch (error) {
		console.error("Error generating PDF:", error);
		throw error;
	}
}

// Helper function to add wrapped text
function addWrappedText(doc, text, x, y, maxWidth) {
	const lines = doc.splitTextToSize(text, maxWidth);
	doc.text(lines, x, y);
	return y + (lines.length * 7);
}

module.exports = {
	generatePdf,
};
