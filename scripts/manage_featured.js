const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PRODUCTS_FILE = path.join(__dirname, '../data/products.json');

// Read existing products
if (!fs.existsSync(PRODUCTS_FILE)) {
  console.error("Error: products.json does not exist. Please run the sync manager or add products first.");
  process.exit(1);
}

let products = [];
try {
  products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
} catch (err) {
  console.error("Error reading products.json:", err.message);
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.clear();
  console.log("======================================================================");
  console.log("             AK INFOTECH - FEATURED PRODUCTS SELECTOR                ");
  console.log("======================================================================");
  console.log(` Loaded ${products.length} products from local JSON database.`);
  console.log("----------------------------------------------------------------------");

  // Get list of categories for filtering
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];

  console.log("\n Available Categories:");
  categories.forEach((cat, i) => console.log(`   [${i + 1}] ${cat}`));
  console.log("   [0] Show All Categories");

  let catFilter = null;
  const catChoice = await askQuestion("\n Select Category filter (Enter number or press Enter for all): ");
  if (catChoice && parseInt(catChoice) > 0 && parseInt(catChoice) <= categories.length) {
    catFilter = categories[parseInt(catChoice) - 1];
    console.log(` Filter set to Category: "${catFilter}"`);
  }

  console.log("\n Available Brands:");
  brands.forEach((br, i) => console.log(`   [${i + 1}] ${br}`));
  console.log("   [0] Show All Brands");

  let brandFilter = null;
  const brandChoice = await askQuestion("\n Select Brand filter (Enter number or press Enter for all): ");
  if (brandChoice && parseInt(brandChoice) > 0 && parseInt(brandChoice) <= brands.length) {
    brandFilter = brands[parseInt(brandChoice) - 1];
    console.log(` Filter set to Brand: "${brandFilter}"`);
  }

  const searchFilter = (await askQuestion("\n Enter text search query (press Enter to skip): ")).toLowerCase().trim();

  // Apply filters
  let filteredProducts = products.filter(p => {
    if (catFilter && p.category !== catFilter) return false;
    if (brandFilter && p.brand !== brandFilter) return false;
    if (searchFilter && !p.productName.toLowerCase().includes(searchFilter)) return false;
    return true;
  });

  if (!filteredProducts.length) {
    console.log("\n No products matched your filter query!");
    const retry = await askQuestion("\n Try again? (Y/N): ");
    if (retry.toLowerCase().startsWith('y')) {
      return main();
    }
    rl.close();
    return;
  }

  // Toggle loop
  while (true) {
    console.clear();
    console.log("======================================================================");
    console.log(` Matching Products (${filteredProducts.length} items):`);
    console.log("======================================================================");
    
    filteredProducts.forEach((p, idx) => {
      const isFeatured = p.isFeatured === true;
      const statusIcon = isFeatured ? "⭐ [FEATURED]" : "[ ]";
      console.log(`  [${idx + 1}] ${statusIcon} - ${p.productName} (${p.brand || ''} | ${p.category || ''})`);
    });

    console.log("\n======================================================================");
    console.log(" Options:");
    console.log("  - Enter product number(s) to toggle featured status (e.g. '1' or '2,5,7')");
    console.log("  - Type 'save' to commit changes to database");
    console.log("  - Type 'exit' to cancel and quit");
    console.log("======================================================================");

    const action = await askQuestion("\n Enter your action: ");
    const cleanAction = action.trim().toLowerCase();

    if (cleanAction === 'exit') {
      console.log("\n Quit without saving.");
      break;
    }

    if (cleanAction === 'save') {
      try {
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
        console.log("\n=========================================================");
        console.log("  ✅ SUCCESS: Products JSON database updated successfully! ");
        console.log("  Run Option 1 (Start Server) to compile static pages.    ");
        console.log("=========================================================");
      } catch (err) {
        console.error("\n Failed to save changes:", err.message);
      }
      break;
    }

    // Parse toggle indices
    const indices = cleanAction.split(',')
      .map(s => parseInt(s.trim()) - 1)
      .filter(idx => idx >= 0 && idx < filteredProducts.length);

    if (indices.length > 0) {
      indices.forEach(idx => {
        const prod = filteredProducts[idx];
        // Toggle the global products item reference
        const originalProd = products.find(p => p.id === prod.id);
        if (originalProd) {
          originalProd.isFeatured = !originalProd.isFeatured;
          prod.isFeatured = originalProd.isFeatured; // keep filtered synced
        }
      });
    } else {
      console.log("\n Invalid input! Press Enter to continue...");
      await askQuestion("");
    }
  }

  rl.close();
}

main().catch(err => {
  console.error("Unhandled error:", err);
  rl.close();
});
