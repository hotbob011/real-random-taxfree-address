// Address Generator

import { randomElement, randomInt, generatePhoneNumber, generateEmail, formatAddress } from './utils.js';
import { getConfig } from './config.js';

function ensureNameArray(maybeList) {
  if (Array.isArray(maybeList)) return maybeList;
  if (!maybeList) return [];
  // Support { male: [...], female: [...] } shape by flattening
  if (typeof maybeList === 'object') {
    const out = [];
    if (Array.isArray(maybeList.male)) out.push(...maybeList.male);
    if (Array.isArray(maybeList.female)) out.push(...maybeList.female);
    return out;
  }
  return [];
}

// Data cache to reduce server requests
const dataCache = new Map();
const CACHE_PREFIX = 'address_data_cache_';
const CACHE_VERSION = 'v1'; // Increment this to invalidate old cache
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Load data from JSON file with caching (memory + localStorage)
async function loadData(filePath) {
  try {
    // Check memory cache first (fastest)
    if (dataCache.has(filePath)) {
      return dataCache.get(filePath);
    }
    
    // Check localStorage cache (survives page refresh)
    const cacheKey = CACHE_PREFIX + filePath;
    try {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        // Check if cache is still valid (not expired)
        if (parsed.timestamp && (Date.now() - parsed.timestamp) < CACHE_EXPIRY) {
          // Restore to memory cache for faster access
          dataCache.set(filePath, parsed.data);
          return parsed.data;
        } else {
          // Cache expired, remove it
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (e) {
      // If localStorage fails (e.g., private mode), continue to fetch
      console.warn('localStorage cache read failed:', e);
    }
    
    // Get user configuration
    const config = getConfig();
    const fileName = filePath.split('/').pop();
    
    // Build paths array based on configuration
    const paths = [];
    
    // If user has configured a custom dataBasePath, use it first
    if (config.dataBasePath) {
      // Ensure trailing slash
      const basePath = config.dataBasePath.endsWith('/') ? config.dataBasePath : config.dataBasePath + '/';
      paths.push(basePath + fileName);
    }
    
    // If autoDetectPaths is enabled (default), add automatic path detection
    // This preserves the original behavior for mockaddress.com
    if (config.autoDetectPaths !== false) {
      const currentPath = window.location.pathname;
      
      // Try multiple possible paths
      // Priority: relative path (../data/) first to avoid cross-language references
      paths.push(
        `../data/${fileName}`,          // Relative: go up one level, then into data (works for all language versions)
        `data/${fileName}`,             // Relative to current directory (fallback)
        filePath                        // Original path (fallback)
      );
      
      // Add language-specific absolute paths if we're in a language subdirectory
      const pathParts = currentPath.split('/').filter(p => p && p !== 'index.html' && p !== '');
      if (pathParts.length >= 1 && ['en', 'ru', 'es', 'pt'].includes(pathParts[0])) {
        // We're in a language subdirectory, add language-specific absolute path
        const lang = pathParts[0];
        paths.splice(paths.length - 2, 0, `/${lang}/data/${fileName}`); // Insert before fallback paths
      } else {
        // We're in root (Chinese version), add root absolute path
        paths.splice(paths.length - 2, 0, `/data/${fileName}`); // Insert before fallback paths
      }
    }
    
    let lastError = null;
    for (const path of paths) {
      try {
        const response = await fetch(path, {
          // Add cache control to help browser cache
          cache: 'default'
        });
        if (response.ok) {
          const data = await response.json();
          // Store in memory cache for current session
          dataCache.set(filePath, data);
          
          // Also store in localStorage for persistence across page refreshes
          try {
            const cacheKey = CACHE_PREFIX + filePath;
            const cacheData = {
              data: data,
              timestamp: Date.now(),
              version: CACHE_VERSION
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          } catch (e) {
            // If localStorage fails (e.g., quota exceeded, private mode), continue
            console.warn('localStorage cache write failed:', e);
          }
          
          return data;
        } else {
          // Store the error but continue trying
          lastError = `HTTP ${response.status} for ${path}`;
        }
      } catch (e) {
        // Store the error but continue trying
        lastError = e.message;
        continue;
      }
    }
    
    // If all paths failed, log error but still throw to allow error handling
    console.error(`Failed to load ${filePath}. Tried paths:`, paths);
    console.error(`Last error:`, lastError);
    throw new Error(`Failed to load ${filePath} from any path`);
  } catch (error) {
    console.error(`Error loading data from ${filePath}:`, error);
    throw error;
  }
}

// Generate US address
export async function generateUSAddress(selectedState = 'RANDOM') {
  try {
    const usData = await loadData('data/usData.json');
    const namesData = await loadData('data/namesData.json');
    
    // Select state
    let stateCode = selectedState;
    if (selectedState === 'RANDOM') {
      const states = Object.keys(usData.states);
      stateCode = randomElement(states);
    }
    
    const state = usData.states[stateCode];
    if (!state) {
      throw new Error(`State ${stateCode} not found`);
    }
    
    // Generate name - decide gender first, then select name
    const nameGroup = namesData.nameGroups.western;
    const gender = Math.random() > 0.5 ? 'Male' : 'Female'; // English: Male/Female
    // Select name based on gender - use gender-specific name lists if available
    let firstName;
    if (nameGroup.first.male && nameGroup.first.female) {
      // Use gender-specific name lists
      firstName = randomElement(gender === 'Male' ? nameGroup.first.male : nameGroup.first.female);
    } else {
      // Fallback: use all names if gender classification not available
      firstName = randomElement(nameGroup.first);
    }
    const lastName = randomElement(nameGroup.last);
    
    // Generate phone
    const areaCode = randomElement(state.area_codes);
    const phone = generatePhoneNumber(areaCode);
    
    // Generate email
    const email = generateEmail(firstName, lastName);
    
    // Generate address components - use common US street names (these exist in most US cities)
    const streetNumber = randomInt(100, 9999);
    const streetNames = [
      'Main Street', 'Oak Avenue', 'Park Road', 'Maple Drive', 'Elm Street',
      'Washington Avenue', 'Lincoln Street', 'Jefferson Drive', 'Madison Road',
      'Franklin Avenue', 'Church Street', 'Market Street', 'Broadway',
      'First Street', 'Second Street', 'Third Avenue', 'Fourth Street',
      'Fifth Street', 'Sixth Street', 'Seventh Street', 'Eighth Street',
      'Ninth Street', 'Tenth Street', 'Pine Street', 'Cedar Avenue',
      'Spring Street', 'Summer Street', 'Winter Street', 'Lake Avenue',
      'River Road', 'Hill Street', 'Valley Drive', 'Forest Avenue',
      'Garden Street', 'Rose Avenue', 'Sunset Boulevard', 'Sunrise Drive',
      'College Avenue', 'University Drive', 'School Street', 'Library Lane'
    ];
    const streetName = randomElement(streetNames);
    const street = `${streetNumber} ${streetName}`;
    
    // Generate city - use state-specific cities if available, otherwise use fallback
    let city;
    if (state.cities && state.cities.length > 0) {
      // Use cities from the state's city list
      city = randomElement(state.cities);
    } else {
      // Fallback: use common US city names (should not happen if data is complete)
      const fallbackCities = [
        'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
        'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose',
        'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte',
        'San Francisco', 'Indianapolis', 'Seattle', 'Denver', 'Washington'
      ];
      city = randomElement(fallbackCities);
    }
    
    // Generate zip code - use state-specific zip range if available, otherwise use fallback
    let zip;
    if (state.zip_range && state.zip_range.min && state.zip_range.max) {
      // Use zip code range from the state's zip_range
      zip = randomInt(state.zip_range.min, state.zip_range.max).toString();
    } else {
      // Fallback: use random 5-digit zip code (should not happen if data is complete)
      zip = randomInt(10000, 99999).toString();
    }
    
    // Full address should be in English only
    const stateNameEn = state.name.en || state.name.zh;
    const fullAddress = `${street}, ${city}, ${stateNameEn} ${zip}`;
    
    return {
      firstName,
      lastName,
      gender,
      phone,
      email,
      street,
      city,
      state: stateNameEn, // 显示英文州名
      stateCode,
      zip,
      fullAddress,
      country: 'US'
    };
  } catch (error) {
    console.error('Error generating US address:', error);
    throw error;
  }
}

// Generate Hong Kong address
// selectedRegion: 'RANDOM' | 'HK' | 'KL' | 'NT'
// isEnglish: true -> 生成英文姓名和英文地址；false -> 保持中文
export async function generateHKAddress(selectedRegion = 'RANDOM', isEnglish = false) {
  try {
    const hkData = await loadData('data/hkData.json');
    const namesData = await loadData('data/namesData.json');
    
    // Filter districts based on selected region
    let availableDistricts = {};
    if (selectedRegion === 'RANDOM') {
      // Use all districts
      availableDistricts = hkData.districts;
    } else if (hkData.districts[selectedRegion]) {
      // Use only the selected region
      availableDistricts[selectedRegion] = hkData.districts[selectedRegion];
    } else {
      // Fallback to all districts if invalid selection
      availableDistricts = hkData.districts;
    }
    
    // Select random district and area from filtered districts
    const districts = Object.keys(availableDistricts);
    if (districts.length === 0) {
      throw new Error('No districts available for selected region');
    }
    
    const districtKey = randomElement(districts);
    const district = availableDistricts[districtKey];
    const area = randomElement(district.areas);
    
    // Generate name
    let firstName;
    let lastName;
    let gender;

    if (isEnglish && hkData.names && hkData.names.en) {
      // 英文模式：使用 hkData 内置的英文化姓名（香港拼音格式）
      // 为了符合Apple ID等注册要求，名字组合成2-3个字（更符合香港人传统姓名习惯）
      const nameGroupEn = hkData.names.en;
      const isMale = Math.random() > 0.5;
      gender = isMale ? 'Male' : 'Female'; // 修复：性别逻辑正确对应
      const firstPool = isMale ? nameGroupEn.first.male : nameGroupEn.first.female;
      
      // 组合2-3个字的名字（70%概率双字，30%概率三字）
      if (firstPool && firstPool.length > 0) {
        const nameCount = Math.random() < 0.7 ? 2 : 3; // 70%双字，30%三字
        const selectedNames = [];
        const availableNames = [...firstPool]; // 复制数组避免修改原数组
        
        for (let i = 0; i < nameCount && availableNames.length > 0; i++) {
          const selected = randomElement(availableNames);
          selectedNames.push(selected);
          // 移除已选的名字，避免重复
          const index = availableNames.indexOf(selected);
          if (index > -1) availableNames.splice(index, 1);
        }
        
        firstName = selectedNames.join(' '); // 用空格连接，如 "Wing Man" 或 "Wing Man Kai"
      } else {
        firstName = randomElement(firstPool || []);
      }
      
      lastName = randomElement(nameGroupEn.last || []);
      
      // 如果数据异常，兜底
      if (!firstName || !lastName) {
        const fallback = namesData.nameGroups.western;
        gender = Math.random() > 0.5 ? 'Male' : 'Female';
        firstName = randomElement(
          gender === 'Male' ? fallback.first.male : fallback.first.female
        );
        lastName = randomElement(fallback.last);
      }
    } else {
      // 中文模式：沿用原有中文姓名逻辑
      const nameGroup = namesData.nameGroups.chinese;
      gender = Math.random() > 0.5 ? '男' : '女'; // 中文：男/女
      firstName = randomElement(gender === '男' ? nameGroup.first.male : nameGroup.first.female);
      lastName = randomElement(nameGroup.last);
    }

    // Generate phone (Hong Kong format: +852 XXXX XXXX)
    const phone = `+852 ${randomInt(2000, 9999)} ${randomInt(1000, 9999)}`;
    
    // Hong Kong has no official postal code; use fixed placeholder for forms
    const zip = '000000';
    
    // Generate email - use English names for email to avoid Chinese characters
    const englishNameGroup = namesData.nameGroups.western || namesData.nameGroups.asian;
    let emailFirstName, emailLastName;
    if (englishNameGroup && englishNameGroup.first && englishNameGroup.last) {
      const firstList = ensureNameArray(englishNameGroup.first);
      const lastList = ensureNameArray(englishNameGroup.last);
      emailFirstName = randomElement(firstList);
      emailLastName = randomElement(lastList);
    } else {
      // Fallback: generate random English username
      const randomNames = ['john', 'mary', 'david', 'sarah', 'michael', 'emily', 'james', 'lisa', 'robert', 'anna'];
      emailFirstName = randomElement(randomNames);
      emailLastName = randomElement(randomNames);
    }
    const email = generateEmail(emailFirstName, emailLastName);
    
    // Generate address
    const floor = randomInt(1, 50);
    const unit = randomInt(1, 20);

    let street;
    let building;
    let address;
    let city;
    let districtName;
    let fullAddress;

    if (isEnglish) {
      street = randomElement(area.streets.en);
      building = randomElement(area.buildings.en);
      // 英文地址格式：Flat 12, 32/F, Building Name, Street Name
      address = `Flat ${unit}, ${floor}/F, ${building}, ${street}`;
      city = area.name_en;
      districtName = district.name.en;
      fullAddress = `${address}, ${city}, ${districtName}, Hong Kong`;
      // 英文模式下，性别字段统一英文化
      gender = gender === '男' ? 'Male' : gender === '女' ? 'Female' : gender;
    } else {
      street = randomElement(area.streets.zh);
      building = randomElement(area.buildings.zh);
      address = `${street} ${building} ${floor}樓 ${unit}室`;
      city = area.name_zh;
      districtName = district.name.zh;
      fullAddress = `${address}, ${city}, ${districtName}`;
    }
    
    return {
      firstName,
      lastName,
      gender,
      phone,
      email,
      street: address,
      city, // 区域作为城市（中英文根据模式切换）
      county: districtName, // 区作为区县
      district: districtName, // 保留原字段以兼容
      area: city, // 保留原字段以兼容
      fullAddress,
      zip,
      country: 'HK'
    };
  } catch (error) {
    console.error('Error generating HK address:', error);
    throw error;
  }
}

// Generate UK address
export async function generateUKAddress(selectedRegion = 'RANDOM') {
  try {
    const ukData = await loadData('data/ukData.json');
    const namesData = await loadData('data/namesData.json');
    
    // Filter regions based on selected region
    let availableRegions = {};
    if (selectedRegion === 'RANDOM') {
      // Use all regions
      availableRegions = ukData.regions;
    } else if (ukData.regions[selectedRegion]) {
      // Use only the selected region
      availableRegions[selectedRegion] = ukData.regions[selectedRegion];
    } else {
      // Fallback to all regions if invalid selection
      availableRegions = ukData.regions;
    }
    
    // Select random region from filtered regions
    const regions = Object.keys(availableRegions);
    if (regions.length === 0) {
      throw new Error('No regions available for selected region');
    }
    
    const regionKey = randomElement(regions);
    const region = availableRegions[regionKey];
    
    // Generate name - decide gender first, then select name
    const nameGroup = namesData.nameGroups.western;
    const gender = Math.random() > 0.5 ? 'Male' : 'Female'; // English: Male/Female
    // Select name based on gender - use gender-specific name lists if available
    let firstName;
    if (nameGroup.first.male && nameGroup.first.female) {
      // Use gender-specific name lists
      firstName = randomElement(gender === 'Male' ? nameGroup.first.male : nameGroup.first.female);
    } else {
      // Fallback: use all names if gender classification not available
      firstName = randomElement(nameGroup.first);
    }
    const lastName = randomElement(nameGroup.last);
    
    // Generate phone
    const phoneCode = randomElement(region.phone_codes);
    const phone = `0${phoneCode} ${randomInt(1000, 9999)} ${randomInt(100000, 999999)}`;
    
    // Generate email
    const email = generateEmail(firstName, lastName);
    
    // Generate address
    const streetNumbers = [randomInt(1, 999), randomInt(1, 999)];
    const streetName = randomElement([
      'High Street', 'Church Road', 'Park Avenue', 'Main Road', 'London Road',
      'Victoria Street', 'King Street', 'Queen Street', 'Market Street',
      'Station Road', 'Mill Lane', 'Bridge Street', 'New Street', 'Old Street',
      'Castle Street', 'Church Street', 'School Lane', 'Garden Street', 'Hill Road',
      'Oak Avenue', 'Elm Street', 'Maple Drive', 'Cedar Road', 'Pine Street',
      'Rose Lane', 'Lily Street', 'Orchard Road', 'Meadow Way', 'River Street'
    ]);
    const street = `${streetNumbers[0]}${streetNumbers[1] > 0 ? '-' + streetNumbers[1] : ''} ${streetName}`;
    
    // Generate city - use region-specific cities if available, otherwise use fallback
    let city;
    if (region.cities && region.cities.length > 0) {
      // Use cities from the region's city list
      city = randomElement(region.cities);
    } else {
      // Fallback: use common UK city names (should not happen if data is complete)
      const fallbackCities = [
        'London', 'Manchester', 'Birmingham', 'Liverpool', 'Leeds',
        'Glasgow', 'Edinburgh', 'Bristol', 'Cardiff', 'Belfast'
      ];
      city = randomElement(fallbackCities);
    }
    
    // UK postcode format: SW1A 1AA - use region-specific postcode areas if available
    let postcodeArea;
    if (region.postcode_areas && region.postcode_areas.length > 0) {
      // Use postcode areas from the region's list
      postcodeArea = randomElement(region.postcode_areas);
    } else {
      // Fallback: use common UK postcode areas (should not happen if data is complete)
      postcodeArea = randomElement(['SW', 'NW', 'SE', 'NE', 'W', 'E', 'N', 'S']);
    }
    const postcode = `${postcodeArea}${randomInt(1, 9)}${randomElement(['A', 'B', 'C'])} ${randomInt(1, 9)}${randomElement(['A', 'B', 'C'])}${randomElement(['A', 'B', 'C'])}`;
    
    // Use English region name for full address and region field
    const regionNameEn = region.name.en || region.name.zh;
    const fullAddress = `${street}, ${city}, ${postcode}, ${regionNameEn}`;
    
    return {
      firstName,
      lastName,
      gender,
      phone,
      email,
      street,
      city,
      postcode,
      region: regionNameEn, // 显示英文地区名
      fullAddress,
      country: 'UK'
    };
  } catch (error) {
    console.error('Error generating UK address:', error);
    throw error;
  }
}

// Generate Canada address
export async function generateCAAddress(selectedProvince = 'RANDOM') {
  try {
    const caData = await loadData('data/caData.json');
    const namesData = await loadData('data/namesData.json');
    
    // Filter provinces based on selected province
    let availableProvinces = {};
    if (selectedProvince === 'RANDOM') {
      // Use all provinces
      availableProvinces = caData.provinces;
    } else if (caData.provinces[selectedProvince]) {
      // Use only the selected province
      availableProvinces[selectedProvince] = caData.provinces[selectedProvince];
    } else {
      // Fallback to all provinces if invalid selection
      availableProvinces = caData.provinces;
    }
    
    // Select random province from filtered provinces
    const provinces = Object.keys(availableProvinces);
    if (provinces.length === 0) {
      throw new Error('No provinces available for selected province');
    }
    
    const provinceKey = randomElement(provinces);
    const province = availableProvinces[provinceKey];
    
    // Generate name - decide gender first, then select name
    const nameGroup = namesData.nameGroups.western;
    const gender = Math.random() > 0.5 ? 'Male' : 'Female'; // English: Male/Female
    // Select name based on gender - use gender-specific name lists if available
    let firstName;
    if (nameGroup.first.male && nameGroup.first.female) {
      // Use gender-specific name lists
      firstName = randomElement(gender === 'Male' ? nameGroup.first.male : nameGroup.first.female);
    } else {
      // Fallback: use all names if gender classification not available
      firstName = randomElement(nameGroup.first);
    }
    const lastName = randomElement(nameGroup.last);
    
    // Generate phone
    const areaCode = randomElement(province.area_codes);
    const phone = `(${areaCode}) ${randomInt(200, 999)}-${randomInt(1000, 9999)}`;
    
    // Generate email
    const email = generateEmail(firstName, lastName);
    
    // Generate address
    const streetNumber = randomInt(100, 9999);
    const streetName = randomElement([
      'Main Street', 'Oak Avenue', 'Park Road', 'Maple Drive', 'Elm Street',
      'King Street', 'Queen Street', 'Church Street', 'Market Street',
      'First Street', 'Second Street', 'Third Avenue', 'Fourth Street',
      'Bay Street', 'Yonge Street', 'University Avenue', 'College Street',
      'Dundas Street', 'Bloor Street', 'Queen Street', 'King Street',
      'River Road', 'Lake Avenue', 'Hill Street', 'Valley Drive',
      'Forest Avenue', 'Garden Street', 'Rose Lane', 'Pine Street'
    ]);
    const street = `${streetNumber} ${streetName}`;
    
    // Generate city - use province-specific cities if available, otherwise use fallback
    let city;
    if (province.cities && province.cities.length > 0) {
      // Use cities from the province's city list
      city = randomElement(province.cities);
    } else {
      // Fallback: use common Canadian city names (should not happen if data is complete)
      const fallbackCities = [
        'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa',
        'Edmonton', 'Winnipeg', 'Quebec City', 'Hamilton', 'Halifax'
      ];
      city = randomElement(fallbackCities);
    }
    
    // Canadian postal code format: A1A 1A1 - use province-specific prefixes if available
    let postcodePrefix;
    if (province.postcode_prefixes && province.postcode_prefixes.length > 0) {
      // Use postcode prefixes from the province's list
      postcodePrefix = randomElement(province.postcode_prefixes);
    } else {
      // Fallback: use common Canadian postal code prefixes (should not happen if data is complete)
      postcodePrefix = randomElement(['A', 'B', 'C', 'E', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'X', 'Y']);
    }
    const postcode = `${postcodePrefix}${randomInt(0, 9)}${randomElement(['A', 'B', 'C', 'E', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z'])} ${randomInt(0, 9)}${randomElement(['A', 'B', 'C', 'E', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z'])}${randomInt(0, 9)}`;
    
    // Use English province name for full address and province field
    const provinceNameEn = province.name.en || province.name.zh;
    const fullAddress = `${street}, ${city}, ${provinceNameEn} ${postcode}`;
    
    return {
      firstName,
      lastName,
      gender,
      phone,
      email,
      street,
      city,
      postcode,
      province: provinceNameEn, // 显示英文省份名
      fullAddress,
      country: 'CA'
    };
  } catch (error) {
    console.error('Error generating CA address:', error);
    throw error;
  }
}

// Generate Japan address
export async function generateJPAddress(selectedPrefecture = 'RANDOM') {
  try {
    const jpData = await loadData('data/jpData.json');
    const jpNamesData = await loadData('data/jpNamesData.json');
    const namesData = await loadData('data/namesData.json');
    
    // Filter prefectures based on selected prefecture
    let availablePrefectures = {};
    if (selectedPrefecture === 'RANDOM') {
      // Use all prefectures
      availablePrefectures = jpData.prefectures || {};
    } else if (jpData.prefectures && jpData.prefectures[selectedPrefecture]) {
      // Use only the selected prefecture
      availablePrefectures[selectedPrefecture] = jpData.prefectures[selectedPrefecture];
    } else {
      // Fallback to all prefectures if invalid selection
      availablePrefectures = jpData.prefectures || {};
    }
    
    // Select random prefecture from filtered prefectures
    const prefectures = Object.keys(availablePrefectures);
    if (prefectures.length === 0) {
      throw new Error('No prefectures available for selected prefecture');
    }
    
    const prefectureKey = randomElement(prefectures);
    const prefecture = availablePrefectures[prefectureKey];
    
    // Generate name using Japanese names database (kanji, hiragana, katakana)
    // Japanese surnames (姓) are almost always in kanji, rarely in hiragana/katakana
    const surnameScriptTypes = ['kanji', 'kanji', 'kanji', 'kanji', 'kanji', 'kanji', 'kanji', 'kanji', 'kanji', 'hiragana']; // 90% kanji, 10% hiragana
    const surnameScriptType = randomElement(surnameScriptTypes);
    const lastNames = jpNamesData.surnames[surnameScriptType] || jpNamesData.surnames.kanji;
    const lastName = randomElement(lastNames);
    
    // Japanese first names (名) can be in kanji, hiragana, or katakana
    const firstNameScriptTypes = ['kanji', 'kanji', 'kanji', 'hiragana', 'katakana']; // 60% kanji, 20% hiragana, 20% katakana
    const firstNameScriptType = randomElement(firstNameScriptTypes);
    
    const isMale = Math.random() > 0.5;
    
    // Get first name based on gender and script type
    let firstName;
    if (isMale) {
      const maleNames = jpNamesData.firstNames.male[firstNameScriptType] || jpNamesData.firstNames.male.kanji;
      firstName = randomElement(maleNames);
    } else {
      const femaleNames = jpNamesData.firstNames.female[firstNameScriptType] || jpNamesData.firstNames.female.kanji;
      firstName = randomElement(femaleNames);
    }
    
    // Gender in Japanese
    const gender = isMale ? '男性' : '女性';
    
    // Generate phone (Japan format: 0X-XXXX-XXXX) - use prefecture-specific phone codes if available
    let phoneCode;
    if (prefecture && prefecture.phone_codes && prefecture.phone_codes.length > 0) {
      // Use phone codes from the prefecture's list
      const selectedCode = randomElement(prefecture.phone_codes);
      // Remove leading 0 if present and format
      phoneCode = selectedCode.toString().replace(/^0+/, '');
    } else {
      // Fallback: use random phone code (should not happen if data is complete)
      phoneCode = randomInt(3, 9).toString();
    }
    const phone = `0${phoneCode}-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`;
    
    // Generate email - use English names for email to avoid non-ASCII characters
    const englishNameGroup = namesData.nameGroups.western || namesData.nameGroups.asian;
    let emailFirstName, emailLastName;
    if (englishNameGroup && englishNameGroup.first && englishNameGroup.last) {
      const firstList = ensureNameArray(englishNameGroup.first);
      const lastList = ensureNameArray(englishNameGroup.last);
      // Use Japanese-style names from asian group if available
      const japaneseRomajiNames = firstList.filter(n => 
        ['Hiroshi', 'Takeshi', 'Akira', 'Satoshi', 'Kenji', 'Taro', 'Jiro', 'Ichiro', 'Yuki', 'Ai', 'Emi', 'Yui', 'Rina', 'Miki', 'Saki', 'Nana', 'Kana', 'Mana', 'Hanako', 'Misaki', 'Sakura', 'Aya', 'Rei', 'Mai', 'Eri', 'Yuka'].includes(n)
      );
      const japaneseRomajiLastNames = lastList.filter(n => 
        ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida', 'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto', 'Inoue', 'Kimura', 'Hayashi', 'Shimizu', 'Yamazaki', 'Mori', 'Abe', 'Ikeda', 'Hashimoto', 'Ishikawa', 'Maeda', 'Fujita', 'Ogawa', 'Goto', 'Okada'].includes(n)
      );
      
      if (japaneseRomajiNames.length > 0 && japaneseRomajiLastNames.length > 0) {
        emailFirstName = randomElement(japaneseRomajiNames);
        emailLastName = randomElement(japaneseRomajiLastNames);
      } else {
        emailFirstName = randomElement(firstList);
        emailLastName = randomElement(lastList);
      }
    } else {
      // Fallback: generate random English username
      const randomNames = ['john', 'mary', 'david', 'sarah', 'michael', 'emily', 'james', 'lisa', 'robert', 'anna'];
      emailFirstName = randomElement(randomNames);
      emailLastName = randomElement(randomNames);
    }
    const email = generateEmail(emailFirstName, emailLastName);
    
    // Generate address using real Japanese address data
    // Use kanji for addresses (most common in real addresses)
    const addressData = jpData.address_data || {};
    
    // City - use prefecture-specific cities if available, otherwise use fallback
    let city;
    if (prefecture && prefecture.cities && prefecture.cities.length > 0) {
      // Use cities from the prefecture's city list
      city = randomElement(prefecture.cities);
    } else {
      // Fallback: use common Japanese city names (should not happen if data is complete)
      const fallbackCities = addressData.cities?.kanji || ['東京', '大阪', '京都', '横浜', '名古屋', '札幌', '福岡', '神戸', '仙台', '広島', '千葉', '埼玉', '新潟', '静岡', '浜松', '岡山', '熊本', '鹿児島', '長崎', '大分'];
      city = randomElement(fallbackCities);
    }
    
    // Ward/丁目 (use kanji)
    const wards = addressData.wards?.kanji || ['1丁目', '2丁目', '3丁目', '4丁目', '5丁目', '6丁目', '7丁目', '8丁目', '9丁目', '10丁目'];
    const ward = randomElement(wards);
    
    // Street name (use kanji from real street data)
    const streets = addressData.streets?.kanji || ['中央', '本町', '新町', '大通', '駅前', '公園', '桜', '松', '竹', '梅', '富士', '山', '川', '海', '森', '田', '橋', '坂', '谷', '原'];
    const streetName = randomElement(streets);
    
    // District (区/市) - optional, sometimes included
    const includeDistrict = Math.random() > 0.7; // 30% chance to include district
    let district = '';
    if (includeDistrict && addressData.districts?.kanji) {
      district = randomElement(addressData.districts.kanji) + '';
    }
    
    const streetNumber = randomInt(1, 50);
    const buildingNumber = randomInt(1, 20);
    
    // Build address: [district] [street] [ward] [number]番[building]号
    let address;
    if (district) {
      address = `${district}${streetName}${ward}${streetNumber}番${buildingNumber}号`;
    } else {
      address = `${streetName}${ward}${streetNumber}番${buildingNumber}号`;
    }
    
    // Japanese postal code format: 123-4567 (使用都道府県的邮编前缀)
    let postcodePrefix = '100';
    if (prefecture && prefecture.postal_prefix && prefecture.postal_prefix.length > 0) {
      postcodePrefix = randomElement(prefecture.postal_prefix);
    }
    const postcode = `${postcodePrefix}-${randomInt(1000, 9999)}`;
    
    // 使用日文都道府県名称
    const prefectureName = prefecture ? (prefecture.name.ja || prefecture.name.zh) : '東京都';
    const fullAddress = `〒${postcode} ${prefectureName}${city}${address}`;
    
    return {
      firstName,
      lastName,
      gender,
      phone,
      email,
      street: address,
      city,
      prefecture: prefectureName,
      postcode,
      fullAddress,
      country: 'JP'
    };
  } catch (error) {
    console.error('Error generating JP address:', error);
    throw error;
  }
}

// Generate India address
export async function generateINAddress(selectedState = 'RANDOM') {
  try {
    const inData = await loadData('data/inData.json');
    const namesData = await loadData('data/namesData.json');
    
    // Filter states based on selected state
    let availableStates = {};
    if (selectedState === 'RANDOM') {
      // Use all states
      availableStates = inData.states;
    } else if (inData.states[selectedState]) {
      // Use only the selected state
      availableStates[selectedState] = inData.states[selectedState];
    } else {
      // Fallback to all states if invalid selection
      availableStates = inData.states;
    }
    
    // Select random state from filtered states
    const states = Object.keys(availableStates);
    if (states.length === 0) {
      throw new Error('No states available for selected state');
    }
    
    const stateKey = randomElement(states);
    const state = availableStates[stateKey];
    
    // Generate name (Indian) - decide gender first, then select name
    const nameGroup = namesData.nameGroups.indian;
    const gender = Math.random() > 0.5 ? 'Male' : 'Female'; // English: Male/Female
    // Select name based on gender - use gender-specific name lists if available
    let firstName;
    if (nameGroup.first.male && nameGroup.first.female) {
      // Use gender-specific name lists
      firstName = randomElement(gender === 'Male' ? nameGroup.first.male : nameGroup.first.female);
    } else {
      // Fallback: use all names if gender classification not available
      firstName = randomElement(nameGroup.first);
    }
    const lastName = randomElement(nameGroup.last);
    
    // Generate phone (India format: +91 XXXXXXXXXX) - use state-specific area codes if available
    let phoneNumber;
    if (state.area_codes && state.area_codes.length > 0) {
      // Use area codes from the state's list (format: XXXX, convert to phone number)
      const areaCode = randomElement(state.area_codes);
      // Indian mobile numbers start with 6-9, generate remaining digits
      const mobilePrefix = randomElement([6, 7, 8, 9]);
      const remainingDigits = randomInt(10000000, 99999999);
      phoneNumber = `${mobilePrefix}${remainingDigits}`;
    } else {
      // Fallback: use random phone number (should not happen if data is complete)
      phoneNumber = randomInt(6000000000, 9999999999).toString();
    }
    const phone = `+91 ${phoneNumber}`;
    
    // Generate email
    const email = generateEmail(firstName, lastName);
    
    // Generate address
    const streetNumber = randomInt(1, 999);
    const streetName = randomElement([
      'Main Road', 'Gandhi Street', 'Nehru Road', 'Park Street', 'Market Road',
      'Church Street', 'Temple Street', 'School Road', 'Hospital Road',
      'MG Road', 'Station Road', 'Airport Road', 'Highway Road', 'Ring Road',
      'First Street', 'Second Street', 'Third Street', 'Fourth Street',
      'Gandhi Nagar', 'Nehru Nagar', 'Rajiv Nagar', 'Indira Nagar',
      'College Road', 'University Road', 'Library Road', 'Museum Road'
    ]);
    const street = `${streetNumber}, ${streetName}`;
    
    // Generate city - use state-specific cities if available, otherwise use fallback
    let city;
    if (state.cities && state.cities.length > 0) {
      // Use cities from the state's city list
      city = randomElement(state.cities);
    } else {
      // Fallback: use common Indian city names (should not happen if data is complete)
      const fallbackCities = [
        'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai',
        'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat'
      ];
      city = randomElement(fallbackCities);
    }
    
    // Indian PIN code (6 digits) - use state-specific PIN range if available
    let pin;
    if (state.pin_range && state.pin_range.min && state.pin_range.max) {
      // Use PIN code range from the state's pin_range
      pin = randomInt(state.pin_range.min, state.pin_range.max).toString();
    } else {
      // Fallback: use random 6-digit PIN code (should not happen if data is complete)
      pin = randomInt(100000, 999999).toString();
    }
    
    // Use English state name for full address and state field
    const stateNameEn = state.name.en || state.name.zh;
    const fullAddress = `${street}, ${city}, ${stateNameEn} ${pin}`;
    
    return {
      firstName,
      lastName,
      gender,
      phone,
      email,
      street,
      city,
      state: stateNameEn, // 显示英文邦名
      pin,
      fullAddress,
      country: 'IN'
    };
  } catch (error) {
    console.error('Error generating IN address:', error);
    throw error;
  }
}

// Generate Taiwan address
export async function generateTWAddress(selectedCounty = 'RANDOM') {
  try {
    const namesData = await loadData('data/namesData.json');
    
    // Try to load Taiwan data
    let twData = null;
    let selectedCountyData = null;
    try {
      twData = await loadData('data/twData.json');
      if (twData && twData.counties) {
        // Filter counties based on selected county
        let availableCounties = {};
        if (selectedCounty === 'RANDOM') {
          // Use all counties
          availableCounties = twData.counties;
        } else if (twData.counties[selectedCounty]) {
          // Use only the selected county
          availableCounties[selectedCounty] = twData.counties[selectedCounty];
        } else {
          // Fallback to all counties if invalid selection
          availableCounties = twData.counties;
        }
        
        // Select random county from filtered counties
        const counties = Object.keys(availableCounties);
        if (counties.length > 0) {
          const countyKey = randomElement(counties);
          selectedCountyData = availableCounties[countyKey];
        }
      }
    } catch (e) {
      // If data file doesn't exist, use fallback
      console.warn('Taiwan data file not found, using fallback');
    }
    
    // Generate name (Chinese) - decide gender first, then select name
    const nameGroup = namesData.nameGroups.chinese;
    const gender = Math.random() > 0.5 ? '男' : '女'; // 中文：男/女
    const firstName = randomElement(gender === '男' ? nameGroup.first.male : nameGroup.first.female);
    const lastName = randomElement(nameGroup.last);
    
    // Generate phone (Taiwan format: 09XX-XXX-XXX) - use county-specific area codes if available
    let phoneAreaCode;
    if (selectedCountyData && selectedCountyData.phone_area_codes && selectedCountyData.phone_area_codes.length > 0) {
      // Use phone area codes from the county's list
      phoneAreaCode = randomElement(selectedCountyData.phone_area_codes);
    } else {
      // Fallback: use random area code (should not happen if data is complete)
      phoneAreaCode = randomInt(2, 9);
    }
    const phone = `09${phoneAreaCode}${randomInt(10, 99)}-${randomInt(100, 999)}-${randomInt(100, 999)}`;
    
    // Generate email - use English names for email to avoid Chinese characters
    const englishNameGroup = namesData.nameGroups.western || namesData.nameGroups.asian;
    let emailFirstName, emailLastName;
    if (englishNameGroup && englishNameGroup.first && englishNameGroup.last) {
      const firstList = ensureNameArray(englishNameGroup.first);
      const lastList = ensureNameArray(englishNameGroup.last);
      emailFirstName = randomElement(firstList);
      emailLastName = randomElement(lastList);
    } else {
      // Fallback: generate random English username
      const randomNames = ['john', 'mary', 'david', 'sarah', 'michael', 'emily', 'james', 'lisa', 'robert', 'anna'];
      emailFirstName = randomElement(randomNames);
      emailLastName = randomElement(randomNames);
    }
    const email = generateEmail(emailFirstName, emailLastName);
    
    // Generate address
    // Use county data if available, otherwise use fallback cities
    let city, district;
    if (selectedCountyData && selectedCountyData.name) {
      city = selectedCountyData.name.zh;
      // Use common districts for the selected city
      district = randomElement(['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區']);
    } else {
      // Fallback cities
      const cities = ['台北市', '新北市', '台中市', '台南市', '高雄市', '桃園市'];
      city = randomElement(cities);
      district = randomElement(['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區']);
    }
    
    const street = randomElement([
      '中山路', '中正路', '民生路', '民權路', '民族路',
      '建國路', '復興路', '和平路', '自由路', '成功路',
      '忠孝路', '仁愛路', '信義路', '和平路', '光復路',
      '中華路', '文化路', '大學路', '公園路', '車站路',
      '中央路', '大同路', '大安路', '大業路', '大興路',
      '新生路', '新興路', '新市路', '新莊路', '新店路'
    ]);
    const streetNumber = randomInt(1, 999);
    const address = `${city}${district}${street}${streetNumber}號`;
    
    // Taiwan postal code (5 digits) - use county-specific postcode range if available
    let postcode;
    if (selectedCountyData && selectedCountyData.postcode_range && selectedCountyData.postcode_range.min && selectedCountyData.postcode_range.max) {
      // Use postcode range from the county's postcode_range
      postcode = randomInt(selectedCountyData.postcode_range.min, selectedCountyData.postcode_range.max).toString();
    } else {
      // Fallback: use random 5-digit postcode (should not happen if data is complete)
      postcode = randomInt(10000, 99999).toString();
    }
    
    const fullAddress = `${address}, 郵遞區號: ${postcode}`;
    
    return {
      firstName,
      lastName,
      gender,
      phone,
      email,
      street: address,
      city,
      district,
      postcode,
      fullAddress,
      country: 'TW'
    };
  } catch (error) {
    console.error('Error generating TW address:', error);
    throw error;
  }
}

// Generate tax-free US address (only from tax-free states)
export async function generateTaxFreeAddress(selectedState = 'DE') {
  const taxFreeStates = ['AK', 'DE', 'MT', 'NH', 'OR'];
  
  if (!taxFreeStates.includes(selectedState)) {
    selectedState = randomElement(taxFreeStates);
  }
  
  return await generateUSAddress(selectedState);
}

// Generate identity information
export async function generateIdentityInfo(address) {
  try {
    // Load names data - use the same loadData function which handles paths correctly
    const namesData = await loadData('data/namesData.json');
    if (!namesData || !namesData.nameGroups) {
      throw new Error('Names data not available');
    }
    
    // Use the same name group as the address based on country
    const c = address.country || '';
    let nameGroup;
    if (c === '香港' || c === '台灣' || c === 'HK' || c === 'TW') {
      nameGroup = namesData.nameGroups.chinese;
    } else if (c === '印度' || c === 'IN') {
      nameGroup = namesData.nameGroups.indian;
    } else if (c === '日本' || c === 'JP') {
      nameGroup = namesData.nameGroups.asian || namesData.nameGroups.western;
    } else {
      // Default to western names for US, UK, Canada, etc.
      nameGroup = namesData.nameGroups.western || namesData.nameGroups.asian;
    }
    if (!nameGroup) {
      throw new Error('Name group not found');
    }
    
    // Resolve gender for identity (name selection + Taiwan ID gender digit)
    let isMaleForIdentity;
    if (address.gender) {
      const g = address.gender;
      const isMale = g === 'Male' || g === 'male' || g === 'm' || g === '男' || g === '男性' ||
        (typeof g === 'string' && (g.includes('Männlich') || g.includes('男')));
      const isFemale = g === 'Female' || g === 'female' || g === 'f' || g === '女' || g === '女性' ||
        (typeof g === 'string' && (g.includes('Weiblich') || g.includes('女')));
      isMaleForIdentity = isMale ? true : (isFemale ? false : Math.random() > 0.5);
    } else {
      isMaleForIdentity = Math.random() > 0.5;
    }
    
    // Generate name based on address gender if available
    let firstName, lastName;
    if (address.gender) {
      const genderKey = address.gender.toLowerCase();
      const isMale = genderKey === 'male' || genderKey === 'm' || address.gender === '男' || address.gender === '男性' ||
        address.gender.includes('Männlich') || address.gender.includes('男');
      const isFemale = genderKey === 'female' || genderKey === 'f' || address.gender === '女' || address.gender === '女性' ||
        address.gender.includes('Weiblich') || address.gender.includes('女');
      
      // Use gender-specific name lists if available
      if (nameGroup.first.male && nameGroup.first.female) {
        if (isMale) {
          firstName = randomElement(nameGroup.first.male);
        } else if (isFemale) {
          firstName = randomElement(nameGroup.first.female);
        } else {
          // Fallback: randomly choose from either gender
          firstName = randomElement(Math.random() > 0.5 ? nameGroup.first.male : nameGroup.first.female);
        }
      } else {
        // Fallback: use all names if gender classification not available
        firstName = randomElement(Array.isArray(nameGroup.first) ? nameGroup.first : []);
      }
    } else {
      // If no gender specified, randomly choose gender and corresponding name
      const randomGender = Math.random() > 0.5;
      if (nameGroup.first.male && nameGroup.first.female) {
        firstName = randomElement(randomGender ? nameGroup.first.male : nameGroup.first.female);
      } else {
        firstName = randomElement(Array.isArray(nameGroup.first) ? nameGroup.first : []);
      }
    }
    lastName = randomElement(nameGroup.last);
    
    // Generate date of birth (age between 20 and 50)
    const age = randomInt(20, 50);
    const birthYear = new Date().getFullYear() - age;
    const birthMonth = randomInt(1, 12);
    const daysInMonth = new Date(birthYear, birthMonth, 0).getDate();
    const birthDay = randomInt(1, daysInMonth);
    const dateOfBirth = `${birthMonth.toString().padStart(2, '0')}/${birthDay.toString().padStart(2, '0')}/${birthYear}`;
    
    // Generate identity ID based on country
    let ssn;
    const country = address.country || '';
    
    if (country.includes('德国') || country.includes('Germany') || country === 'DE') {
      // Generate German Steuer-ID (Tax ID): 11 digits, format: XX XXX XXX XXX
      const part1 = randomInt(10, 99);
      const part2 = randomInt(100, 999);
      const part3 = randomInt(100, 999);
      const part4 = randomInt(100, 999);
      ssn = `${part1} ${part2} ${part3} ${part4}`;
    } else if (country.includes('英国') || country.includes('UK') || country.includes('United Kingdom') || country === 'UK') {
      // Generate UK NINO: Format: AA 12 34 56 A
      const letters1 = 'ABCDEFGHJKLMNOPRSTUVWXYZ';
      const letters2 = 'ABCDEFGHJKLMNOPRSTUVWXYZ';
      const letter1 = randomElement(letters1.split(''));
      const letter2 = randomElement(letters2.split(''));
      const digits = randomInt(100000, 999999);
      const letter3 = randomElement(letters2.split(''));
      ssn = `${letter1}${letter2} ${digits.toString().slice(0, 2)} ${digits.toString().slice(2, 4)} ${digits.toString().slice(4, 6)} ${letter3}`;
    } else if (country.includes('加拿大') || country.includes('Canada') || country === 'CA') {
      // Generate Canadian SIN: Format: XXX XXX XXX
      const sin1 = randomInt(100, 999);
      const sin2 = randomInt(100, 999);
      const sin3 = randomInt(100, 999);
      ssn = `${sin1} ${sin2} ${sin3}`;
    } else if (country.includes('日本') || country.includes('Japan') || country === 'JP') {
      // Generate Japanese My Number: Format: XXXX-XXXX-XXXX
      const myNum1 = randomInt(1000, 9999);
      const myNum2 = randomInt(1000, 9999);
      const myNum3 = randomInt(1000, 9999);
      ssn = `${myNum1}-${myNum2}-${myNum3}`;
    } else if (country.includes('印度') || country.includes('India') || country === 'IN') {
      // Generate Indian Aadhaar: Format: XXXX XXXX XXXX
      const aadhaar1 = randomInt(1000, 9999);
      const aadhaar2 = randomInt(1000, 9999);
      const aadhaar3 = randomInt(1000, 9999);
      ssn = `${aadhaar1} ${aadhaar2} ${aadhaar3}`;
    } else if (country.includes('香港') || country.includes('Hong Kong') || country === 'HK') {
      // Generate Hong Kong ID Card: Format: A123456(7) or AB123456(7)
      // 70%概率单字母，30%概率双字母
      const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const isDoubleLetter = Math.random() < 0.3;
      let prefix;
      if (isDoubleLetter) {
        const letter1 = randomElement(letters.split(''));
        const letter2 = randomElement(letters.split(''));
        prefix = `${letter1}${letter2}`;
      } else {
        prefix = randomElement(letters.split(''));
      }
      const digits = randomInt(100000, 999999).toString();
      const checkDigit = randomInt(0, 9);
      ssn = `${prefix}${digits}(${checkDigit})`;
    } else if (country.includes('台灣') || country.includes('台湾') || country.includes('Taiwan') || country === 'TW') {
      // Generate Taiwan ID Card: Format: A123456789
      // 1st: letter (birthplace), 2nd: gender (1=Male, 2=Female), 3rd-9th: sequence
      const letters = 'ABCDEFGHJKLMNPQRSTUVXY';
      const firstLetter = randomElement(letters.split(''));
      const genderDigit = isMaleForIdentity ? '1' : '2'; // 1=男, 2=女
      const sequenceDigits = randomInt(10000000, 99999999).toString();
      ssn = `${firstLetter}${genderDigit}${sequenceDigits}`;
    } else if (country.includes('新加坡') || country.includes('Singapore') || country === 'SG') {
      // Generate Singapore NRIC: Format: S1234567D (prefix + 7 digits + check letter)
      // S=citizen pre-2000, T=citizen 2000+, G/F=PR. Prefix should match birth year
      let prefix;
      if (birthYear < 2000) {
        prefix = 'S'; // Born before 2000
      } else {
        prefix = 'T'; // Born in 2000 or later
      }
      // Small chance to be PR (G prefix) regardless of year
      if (Math.random() < 0.1) {
        prefix = 'G'; // Permanent Resident
      }
      const digits = randomInt(1000000, 9999999).toString();
      const checkLetters = 'ABCDEFGHIZJ';
      const checkLetter = randomElement(checkLetters.split(''));
      ssn = `${prefix}${digits}${checkLetter}`;
    } else {
      // Default: US SSN format (XXX-XX-XXXX)
      // SSN Area Number (first 3 digits) should match the state if available
      let ssnAreaNumber;
      if (address.stateCode && (address.country === '美国' || address.country === 'US')) {
        try {
          const usData = await loadData('data/usData.json');
          const state = usData.states[address.stateCode];
          if (state && state.ssn_area_range && state.ssn_area_range.min && state.ssn_area_range.max) {
            // Use state-specific SSN area number range
            ssnAreaNumber = randomInt(state.ssn_area_range.min, state.ssn_area_range.max);
          } else {
            // Fallback: use random area number (avoid 000, 666, and 900-999)
            do {
              ssnAreaNumber = randomInt(1, 899);
            } while (ssnAreaNumber === 666 || ssnAreaNumber < 1);
          }
        } catch (e) {
          // If loading fails, use fallback
          do {
            ssnAreaNumber = randomInt(1, 899);
          } while (ssnAreaNumber === 666 || ssnAreaNumber < 1);
        }
      } else {
        // For non-US addresses or if stateCode is not available, use random area number
        do {
          ssnAreaNumber = randomInt(1, 899);
        } while (ssnAreaNumber === 666 || ssnAreaNumber < 1);
      }
      
      // Generate Group Number (middle 2 digits, cannot be 00)
      const groupNumber = randomInt(1, 99);
      
      // Generate Serial Number (last 4 digits, cannot be 0000)
      const serialNumber = randomInt(1, 9999);
      
      // Format SSN: XXX-XX-XXXX
      ssn = `${ssnAreaNumber.toString().padStart(3, '0')}-${groupNumber.toString().padStart(2, '0')}-${serialNumber.toString().padStart(4, '0')}`;
    }
    
    // Generate occupation (random job title)
    const occupations = [
      'Software Engineer', 'Teacher', 'Doctor', 'Nurse', 'Engineer',
      'Accountant', 'Lawyer', 'Manager', 'Sales Representative', 'Designer',
      'Marketing Specialist', 'Consultant', 'Analyst', 'Administrator', 'Director',
      'Developer', 'Architect', 'Coordinator', 'Supervisor', 'Assistant'
    ];
    const occupation = randomElement(occupations);
    
    return {
      firstName,
      lastName,
      dateOfBirth,
      age,
      ssn,
      occupation
    };
  } catch (error) {
    console.error('Error generating identity info:', error);
    throw error;
  }
}

// Generate credit card information
export async function generateCreditCardInfo() {
  // Card types with their prefixes
  const cardTypes = [
    { name: 'Visa', prefixes: ['4'] },
    { name: 'MasterCard', prefixes: ['51', '52', '53', '54', '55'] },
    { name: 'American Express', prefixes: ['34', '37'] },
    { name: 'Discover', prefixes: ['6011'] }
  ];
  
  // Select random card type
  const selectedCardType = randomElement(cardTypes);
  const prefix = randomElement(selectedCardType.prefixes);
  
  // Generate random credit card number (16 digits, Luhn algorithm)
  function generateLuhnNumber(prefix, length = 16) {
    let cardNumber = prefix;
    // Generate remaining digits (excluding prefix and check digit)
    const remainingDigits = length - prefix.length - 1;
    for (let i = 0; i < remainingDigits; i++) {
      cardNumber += randomInt(0, 9).toString();
    }
    
    // Calculate check digit using Luhn algorithm
    let sum = 0;
    let double = false;
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber[i]);
      if (double) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      double = !double;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    cardNumber += checkDigit.toString();
    
    return cardNumber;
  }
  
  // Generate card number (16 digits for most cards, 15 for Amex)
  const cardLength = selectedCardType.name === 'American Express' ? 15 : 16;
  const cardNumber = generateLuhnNumber(prefix, cardLength);
  
  // Format as XXXX XXXX XXXX XXXX (or XXXX XXXXXX XXXXX for Amex)
  const formattedCardNumber = cardNumber.match(/.{1,4}/g).join(' ');
  
  // Generate expiration date (future date, 1-5 years from now)
  const currentYear = new Date().getFullYear();
  const expYear = currentYear + randomInt(1, 5);
  const expMonth = randomInt(1, 12);
  const expirationDate = `${expMonth.toString().padStart(2, '0')}/${expYear.toString().slice(-2)}`;
  
  // Generate CVV (3 digits for most cards, 4 for Amex)
  const cvvLength = selectedCardType.name === 'American Express' ? 4 : 3;
  const cvv = randomInt(Math.pow(10, cvvLength - 1), Math.pow(10, cvvLength) - 1).toString();
  
  // Generate cardholder name (random Western name)
  const names = ['John', 'Mary', 'David', 'Sarah', 'Michael', 'Emily', 'James', 'Lisa', 'Robert', 'Anna'];
  const surnames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  const cardholderName = `${randomElement(names)} ${randomElement(surnames)}`;
  
  return {
    type: selectedCardType.name,
    number: formattedCardNumber,
    rawNumber: cardNumber,
    expiryDate: expirationDate,
    expirationDate: expirationDate,
    cvv,
    cardholderName
  };
}

// Generate Singapore address
export async function generateSGAddress(selectedState = 'RANDOM') {
  try {
    const sgData = await loadData('data/sgData.json');
    const namesData = await loadData('data/namesData.json');
    
    let availableStates = {};
    if (selectedState === 'RANDOM') {
      availableStates = sgData.states;
    } else if (sgData.states[selectedState]) {
      availableStates[selectedState] = sgData.states[selectedState];
    } else {
      availableStates = sgData.states;
    }
    
    const states = Object.keys(availableStates);
    if (states.length === 0) throw new Error('No regions available');
    
    const stateKey = randomElement(states);
    const state = availableStates[stateKey];
    
    const nameGroup = namesData.nameGroups.western;
    const genderRaw = Math.random() > 0.5 ? 'Male' : 'Female';
    let firstName;
    if (nameGroup.first.male && nameGroup.first.female) {
      firstName = randomElement(genderRaw === 'Male' ? nameGroup.first.male : nameGroup.first.female);
    } else {
      firstName = randomElement(nameGroup.first);
    }
    const lastName = randomElement(nameGroup.last);
    const gender = genderRaw === 'Male' ? 'Male' : 'Female';
    
    const mobilePrefix = randomElement(['8', '9']);
    const subscriberNumber = randomInt(1000000, 9999999);
    const phone = `+65 ${mobilePrefix}${subscriberNumber}`;
    
    const email = generateEmail(firstName, lastName);
    
    const cities = Object.keys(state.cities);
    if (cities.length === 0) throw new Error(`No cities for region ${stateKey}`);
    
    const cityName = randomElement(cities);
    const cityData = state.cities[cityName];
    
    if (!cityData || !cityData.zip || !cityData.streets) {
      throw new Error(`Invalid city data for ${cityName}`);
    }
    
    const zip = randomElement(cityData.zip);
    const streetName = randomElement(cityData.streets);
    
    const useBlockFormat = Math.random() > 0.3;
    let street;
    if (useBlockFormat) {
      const blockNum = randomInt(1, 999);
      const floor = randomInt(1, 25);
      const unit = randomInt(1, 12);
      street = `Block ${blockNum}, ${streetName}, #${floor.toString().padStart(2, '0')}-${unit.toString().padStart(2, '0')}`;
    } else {
      const unitNum = randomInt(1, 200);
      const floor = randomInt(1, 30);
      const unit = randomInt(1, 8);
      street = `${unitNum} ${streetName}, #${floor}-${unit}`;
    }
    
    const stateNameEn = state.name.en || state.name.zh;
    const fullAddress = `${street}, Singapore ${zip}`;
    
    return {
      firstName,
      lastName,
      gender,
      phone,
      email,
      street,
      city: cityName,
      zip,
      postcode: zip,
      state: stateNameEn,
      stateCode: stateKey,
      fullAddress,
      country: 'SG'
    };
  } catch (error) {
    console.error('Error generating SG address:', error);
    throw error;
  }
}

// Generate Germany address
export async function generateDEAddress(selectedState = 'RANDOM') {
  try {
    const deData = await loadData('data/deData.json');
    const namesData = await loadData('data/namesData.json');
    
    // Filter states based on selected state
    let availableStates = {};
    if (selectedState === 'RANDOM') {
      // Use all states
      availableStates = deData.states;
    } else if (deData.states[selectedState]) {
      // Use only the selected state
      availableStates[selectedState] = deData.states[selectedState];
    } else {
      // Fallback to all states if invalid selection
      availableStates = deData.states;
    }
    
    // Select random state from filtered states
    const states = Object.keys(availableStates);
    if (states.length === 0) {
      throw new Error('No states available for selected state');
    }
    
    const stateKey = randomElement(states);
    const state = availableStates[stateKey];
    
    // Generate name - decide gender first, then select name
    const nameGroup = namesData.nameGroups.western;
    const genderRaw = Math.random() > 0.5 ? 'Male' : 'Female';
    // Select name based on gender - use gender-specific name lists if available
    let firstName;
    if (nameGroup.first.male && nameGroup.first.female) {
      // Use gender-specific name lists
      firstName = randomElement(genderRaw === 'Male' ? nameGroup.first.male : nameGroup.first.female);
    } else {
      // Fallback: use all names if gender classification not available
      firstName = randomElement(nameGroup.first);
    }
    const lastName = randomElement(nameGroup.last);
    
    // Convert gender to German format for display: Männlich (男) / Weiblich (女)
    const gender = genderRaw === 'Male' ? 'Männlich (男)' : 'Weiblich (女)';
    
    // Generate phone - German mobile format: +49 1xx xxxxxxx
    // Mobile prefixes: 151, 160, 170, 171, 175 (Telekom); 152, 162, 172, 173, 174 (Vodafone); 157, 163, 176, 177, 178 (O2)
    const mobilePrefixes = ['151', '160', '170', '171', '175', '152', '162', '172', '173', '174', '157', '163', '176', '177', '178'];
    const prefix = randomElement(mobilePrefixes);
    const subscriberNumber = randomInt(1000000, 9999999);
    const phone = `+49 ${prefix} ${subscriberNumber}`;
    
    // Generate email - use generateEmail function (ensures no dot before @)
    const email = generateEmail(firstName, lastName);
    
    // Generate address - select random city from state
    // IMPORTANT: Ensure city is selected from the correct state to avoid cross-state mismatches
    const cities = Object.keys(state.cities);
    if (cities.length === 0) {
      throw new Error(`No cities available for state ${stateKey}`);
    }
    
    const cityName = randomElement(cities);
    const cityData = state.cities[cityName];
    
    // Validate city data structure
    if (!cityData || !cityData.zip || !cityData.streets) {
      throw new Error(`Invalid city data structure for ${cityName} in state ${stateKey}`);
    }
    
    // Get zip code from city data (ensures zip matches the city)
    if (cityData.zip.length === 0) {
      throw new Error(`No zip codes available for city ${cityName} in state ${stateKey}`);
    }
    const zip = randomElement(cityData.zip);
    
    // Get street name from city data (ensures street matches the city)
    if (cityData.streets.length === 0) {
      throw new Error(`No streets available for city ${cityName} in state ${stateKey}`);
    }
    const streetName = randomElement(cityData.streets);
    
    // Generate house number (1-150, occasionally with letter suffix like 12a)
    const houseNumber = randomInt(1, 150);
    const suffix = Math.random() < 0.2 ? String.fromCharCode(97 + randomInt(0, 2)) : '';
    const street = `${streetName} ${houseNumber}${suffix}`;
    
    // Use English state name for full address and state field
    const stateNameEn = state.name.en || state.name.zh;
    const fullAddress = `${street}, ${zip} ${cityName}, ${stateNameEn}, Germany`;
    
    return {
      firstName,
      lastName,
      gender,
      phone,
      email,
      street,
      city: cityName,
      zip,
      postcode: zip,
      state: stateNameEn,
      stateCode: stateKey,
      fullAddress,
      country: 'DE'
    };
  } catch (error) {
    console.error('Error generating DE address:', error);
    throw error;
  }
}
