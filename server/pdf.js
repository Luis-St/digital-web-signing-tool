const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

// This function generates a PDF file from the waiver data using an HTML template
async function generatePdf({ playerName, activityType, signatureData, birthdate, outputPath }) {
	try {
		// Read the HTML template
		const templatePath = path.join(process.cwd(), "waiver-template.html");
		let templateHtml = fs.readFileSync(templatePath, "utf8");
		
		// Prepare variable replacements
		const activityLabel = activityType === "laser-tag" ? "Laser Tag" : "Escape Room";
		const today = new Date().toLocaleDateString();
		
		// Format birthdate if provided
		const formattedBirthdate = new Date(birthdate).toLocaleDateString();
		
		// Replace variables in the template
		templateHtml = templateHtml
			.replace(/{{ PLAYER_NAME }}/g, playerName)
			.replace(/{{ ACTIVITY_TYPE }}/g, activityLabel.toUpperCase())
			.replace(/{{ ACTIVITY_LABEL }}/g, activityLabel)
			.replace(/{{ SIGNATURE_DATA }}/g, signatureData)
			.replace(/{{ TODAY_DATE }}/g, today)
			.replace(/{{ BIRTH_DATE }}/g, formattedBirthdate);
		
		// Create a temporary HTML file
		const tempHtmlFileName = `temp_waiver_${Date.now()}.html`;
		const tempHtmlPath = path.join(path.dirname(outputPath), tempHtmlFileName);
		fs.writeFileSync(tempHtmlPath, templateHtml);
		
		// Launch a headless browser to convert HTML to PDF
		const browser = await puppeteer.launch({ headless: true });
		const page = await browser.newPage();
		
		// Load the temporary HTML file
		await page.goto(`${process.env.PDF_STORAGE_URL}/${tempHtmlFileName}`, { waitUntil: "networkidle0" });
		
		// Generate the PDF
		await page.pdf({
			path: outputPath,
			format: "A4",
			printBackground: true,
			margin: {
				top: "10mm",
				right: "10mm",
				bottom: "10mm",
				left: "10mm",
			},
		});
		
		// Close the browser
		await browser.close();
		
		// Clean up the temporary HTML file
		fs.unlinkSync(tempHtmlPath);
		
		console.log(`PDF generated successfully at: ${outputPath}`);
		return outputPath;
	} catch (error) {
		console.error("Error generating PDF:", error);
		throw error;
	}
}

module.exports = {
	generatePdf,
};
