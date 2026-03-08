# MockAddress Core: Frontend Address & MAC Test Data Engine (Open Source Core)

> This repository contains the open-source **frontend core engine** of MockAddress, for generating authentic-format test addresses and MAC address data across multiple countries/regions.  
> Full production site: <https://mockaddress.com/>

![mockaddress Example image from the homepage of the US Fire State Address Generator.
](https://github.com/hotbob011/real-random-taxfree-address/blob/main/en.pn)


## Project Overview

MockAddress Core is a **pure frontend, zero backend dependency** test data engine designed for developers and QA engineers, providing:

- **Authentic-format address data** conforming to official postal standards (verifiable on Google Maps / Apple Maps)
- Optional **identity fields + credit card fields** (for form/payment flow testing only)
- **MAC address generation + vendor lookup + IPv6 Link-Local derivation** and other network test data

All core logic runs entirely in the browser and can be deployed to any static hosting environment (GitHub Pages, Cloudflare Pages, Vercel, etc.).

> **Note**: This repository only open-sources the **engine and base styles**.  
> Large-scale address datasets and production site page templates remain MockAddress private assets for online services.

---

## Key Features

- **Multi-Country/Region Address Generation (Engine Support)**
  - Supports generating address structures conforming to local postal standards for multiple countries/regions
  - Address fields include complete information: street, city, state/province, postal code, country, etc.
  - Can be extended with localized fields based on country (e.g., Japanese address hierarchy, Hong Kong bilingual addresses)

- **Authentic Format & Verifiable**
  - Address data is based on official postal/statistical data + OpenStreetMap and other public data sources, cleaned and organized
  - Generated results are designed to be **verifiable on Google Maps / Apple Maps and other mapping services**
  - Suitable for registration forms, payment pages, tax calculation logic, and other scenarios requiring strict address format validation

- **Optional Identity & Credit Card Fields (Testing Only)**
  - Optionally generate name, gender, date of birth, occupation, localized ID number formats, etc.
  - Optionally generate credit card numbers (Luhn-validated), expiration date, CVC, and other fields
  - All identity/card data is **randomly generated and does not correspond to any real individuals or real cards**

- **Batch Export & Automation-Friendly**
  - Built-in CSV / JSON export capabilities
  - Suitable for automated testing, regression testing, CI/CD pipelines for bulk test data injection

- **MAC Tools**
  - Generate MAC addresses in multiple formats (colon, hyphen, dot, no separator, etc.)
  - Vendor identification based on OUI dataset
  - Support for deriving IPv6 Link-Local addresses from MAC addresses
  - All logic runs locally in the browser, suitable for network testing, device simulation, and script development

- **Pure Frontend, Privacy-First**
  - No backend service dependency, all logic completed in frontend JS
  - Optionally save generated results to browser `localStorage`, servers do not store any generated data

---

## Repository Structure

```text
src/
  js/
    address-generator.js     # Address/identity/credit card generation engine
    mac-generator.js         # MAC generation and vendor lookup
    storage.js               # Storage, rate limiting, export utilities
    language-switcher.js     # Multi-language routing and internal link rewriting
    utils.js                 # General utility functions
  css/
    main.css                 # Universal dark theme and base UI component styles

README.md                    # Project documentation (this file)
LICENSE                      # Open source license (MIT recommended)
CONTRIBUTING.md              # Contribution guidelines (optional)
ROADMAP.md                   # Roadmap (optional)
```

> **Reminder**: **This repository does not include production site HTML files or large-scale data files `data/*.json`**.  
> These are used for online deployment and are not part of this open-source release.

---

## Usage

### Quick Start

**Option 1: Direct Use (if your data directory is `data/`)**

```html
<script type="module">
  import { generateUSAddress } from './src/js/address-generator.js'
  
  // Direct use, will automatically detect data/ directory
  const address = await generateUSAddress('CA')
  console.log(address)
</script>
```

**Option 2: Custom Data Path (Recommended)**

```html
<script type="module">
  // 1. Import configuration module
  import { configure } from './src/js/config.js'
  import { generateUSAddress } from './src/js/address-generator.js'
  
  // 2. Configure your data path
  configure({
    dataBasePath: 'my-data/',  // Your data directory
    autoDetectPaths: false     // Disable auto-detection
  })
  
  // 3. Use normally
  const address = await generateUSAddress('CA')
  console.log(address)
</script>
```

### Configuration Options

- **`dataBasePath`**: Base path for your data files (e.g., `'my-data/'`, `'/static/data/'`)
- **`autoDetectPaths`**: Whether to enable automatic path detection (default `true`, suitable for mockaddress.com's multi-language structure)

> **Important**: If you don't call `configure()`, the code will use default behavior, **completely unaffected by mockaddress.com's normal operation**.

### Available Functions

- `generateUSAddress(state)` - US addresses
- `generateHKAddress(region, isEnglish)` - Hong Kong addresses
- `generateUKAddress(region)` - UK addresses
- `generateCAAddress(province)` - Canada addresses
- `generateJPAddress(prefecture)` - Japan addresses
- `generateINAddress(state)` - India addresses
- `generateTWAddress(county)` - Taiwan addresses
- `generateSGAddress(state)` - Singapore addresses
- `generateDEAddress(state)` - Germany addresses
- `generateTaxFreeAddress(state)` - US tax-free state addresses
- `generateIdentityInfo(address)` - Identity information
- `generateCreditCardInfo()` - Credit card information (testing only)

For detailed usage instructions, see [`使用说明.md`](./使用说明.md) (Usage Guide in Chinese).

You can also refer to our production site <https://mockaddress.com/> to see real-world usage scenarios and UI design, then customize as needed in your own project.

---

## Deployment Examples: Cloudflare & VPS (Static Hosting)

> The following steps are for developers who want to deploy mockaddress-core themselves, describing only the simplest path for README purposes.

### Deploy with Cloudflare Pages (Recommended for Frontend / Zero Ops Cost Scenarios)

1. Create a repository on GitHub (e.g., `mockaddress-core`), push this project's code to it.
2. Log in to Cloudflare, go to **Pages**, select "Create a project with Git provider", and bind this repository.
3. Build settings:
   - Framework preset: **None / Static Site**
   - Build command: Leave empty (or `npm run build` if you add a build process later)
   - Output directory: Set to project root (or your build output directory)
4. After deployment, ensure:
   - All JS/CSS load correctly via `<script type="module">` / `<link>` relative paths;
   - If you have multi-language subdirectory structures (e.g., `/en/`, `/ru/`), maintain the same directory hierarchy in the repository.

> **Note**: If you only want to open-source the core and don't want to expose the full site, you can deploy only a minimal demo page (or just screenshots, directing users to the production site in the README).

### Deploy with VPS + Nginx (Suitable for Existing Servers)

1. Build or organize the static file structure locally (`src/js`, `src/css`, and your HTML entry).
2. Upload these static files to your VPS (e.g., `/var/www/mockaddress-core` directory).
3. Configure Nginx site (example):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/mockaddress-core;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

4. Reload Nginx: `nginx -s reload` or use the corresponding service management command.
5. Open your browser and visit `http://your-domain.com` to confirm address generation/MAC tools and other features work correctly.

> **VPS deployment essence**: Host this set of frontend files as a **pure static site**, no Node.js / PHP / database or other backend environment required.

---

## Data Sources & Authenticity (Brief Overview)

For complete data sources and more detailed authority information, refer to our publicly available llms documentation online. Here is a brief summary:

- Primarily based on official postal/statistical data and geographic data published by various countries
- Supplemented with open-source geographic data projects such as OpenStreetMap / GeoNames / OpenAddresses
- Cleaned and randomly combined through custom rules to ensure:
  - Address structure conforms to local postal standards
  - Address content is designed to be verifiable on mainstream mapping services
  - Not directly associated with any real personal identity

---

## Open Source Scope & Non-Open Source Parts

**This repository open-sources the following:**

- Frontend engine logic for address/identity/credit card field generation
- Frontend logic for MAC generation and vendor lookup
- Base UI styles (CSS) supporting the above engines
- General routing tools for multi-language static sites (e.g., `language-switcher.js`)

**The following are not included:**

- Production site HTML page templates and all copy
- Large-scale address data files (`data/*.json` production datasets)
- Internal operations scripts, deployment configurations, etc.

---

## Suitable & Unsuitable Use Cases (Important)

**Suitable Use Cases (Examples):**

- Software development and testing environments
- Form validation logic testing
- Cross-border e-commerce / cross-border business address form filling simulation
- UI/UX prototyping and demos
- Educational demonstrations and technical sharing
- Network testing and device simulation (MAC tools)

**Unsuitable Use Cases:**

- Real mailing and shipping addresses
- Long-term real-name account registration and operation
- Circumventing KYC / risk control / legal regulatory purposes
- Any illegal or gray-area uses

---

## Roadmap (Example)

Planned improvements for the open-source core (actual roadmap subject to `ROADMAP.md`):

- Provide clearer TypeScript type definitions
- Split country-specific address generation logic for easier standalone extension/on-demand import
- Enrich export formats and integration examples for easier CI/CD pipeline integration
- Add support for more countries/regions' address formats based on community feedback

---

## Online Examples & Contact

- **Production Site (Full Product, Multi-Language)**:
  - Chinese: <https://mockaddress.com/>
  - English: <https://mockaddress.com/en/>
  - Russian: <https://mockaddress.com/ru/>
  - Spanish: <https://mockaddress.com/es/>
- For more background and information about this site, see the About/Help/Blog pages on the site.

If you have any questions or suggestions during use, welcome to participate via Issues or PRs to help improve this frontend test data engine.

---

## GitHub Topics

**Recommended topics for this repository:**

```
javascript, frontend, address-generator, tax-free-states, global-addresses, 
multi-language, test-data, devtools, qa, testing, mock-data, 
us-address, canada-address, hong-kong-address, mac-address, 
authentic-address, postal-standards, csv-export, json-export, 
browser-only, privacy-first, openstreetmap, address-validation, 
form-testing, automation, ci-cd, static-site, no-backend
```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
