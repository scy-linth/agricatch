# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: table-buttons.spec.js >> Admin Table Buttons >> Catalog table Edit button should be clickable
- Location: tests\table-buttons.spec.js:125:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('#catalog-products-tbody') to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - button "Toggle sidebar" [ref=e4] [cursor=pointer]:
        - generic [ref=e5]: 
      - link "AgriCatch AgriCatch" [ref=e6] [cursor=pointer]:
        - /url: /
        - img "AgriCatch" [ref=e7]
        - generic [ref=e8]: AgriCatch
    - navigation [ref=e9]:
      - list [ref=e10]:
        - listitem [ref=e11]:
          - link "" [ref=e12] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e13]: 
        - listitem [ref=e14]:
          - link "" [ref=e15] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e16]: 
        - listitem: 
        - listitem [ref=e17]:
          - link "Profile staff" [ref=e18] [cursor=pointer]:
            - /url: "#"
            - img "Profile" [ref=e20]
            - generic [ref=e21]: staff
          - text:    
  - complementary [ref=e22]:
    - list [ref=e23]:
      - listitem [ref=e24]: Overview
      - listitem [ref=e25]:
        - link " Dashboard" [ref=e26] [cursor=pointer]:
          - /url: "#overview"
          - generic [ref=e27]: 
          - generic [ref=e28]: Dashboard
      - listitem [ref=e29]: Commerce
      - listitem [ref=e30]:
        - link " Orders" [ref=e31] [cursor=pointer]:
          - /url: "#orders"
          - generic [ref=e32]: 
          - generic [ref=e33]: Orders
      - listitem [ref=e34]:
        - link " Listings" [ref=e35] [cursor=pointer]:
          - /url: "#products"
          - generic [ref=e36]: 
          - generic [ref=e37]: Listings
      - listitem [ref=e38]: Catalog
      - listitem [ref=e39]:
        - link " Catalog " [expanded] [ref=e40] [cursor=pointer]:
          - /url: "#"
          - generic [ref=e41]: 
          - generic [ref=e42]: Catalog
          - generic [ref=e43]: 
        - list [ref=e44]:
          - listitem [ref=e45]:
            - link " Products Catalog" [ref=e46] [cursor=pointer]:
              - /url: "#catalog-products"
              - generic [ref=e47]: 
              - text: Products Catalog
          - listitem [ref=e48]:
            - link " Category Management" [ref=e49] [cursor=pointer]:
              - /url: "#categories"
              - generic [ref=e50]: 
              - text: Category Management
          - listitem [ref=e51]:
            - link " Product Name Requests" [ref=e52] [cursor=pointer]:
              - /url: "#category-requests"
              - generic [ref=e53]: 
              - text: Product Name Requests
      - listitem [ref=e54]: Users
      - listitem [ref=e55]:
        - link " Customers" [ref=e56] [cursor=pointer]:
          - /url: "#users"
          - generic [ref=e57]: 
          - generic [ref=e58]: Customers
      - listitem [ref=e59]:
        - link " Farmers" [ref=e60] [cursor=pointer]:
          - /url: "#farmers"
          - generic [ref=e61]: 
          - generic [ref=e62]: Farmers
      - listitem [ref=e63]: System
      - listitem [ref=e64]:
        - link " Audit Logs" [ref=e65] [cursor=pointer]:
          - /url: "#logs"
          - generic [ref=e66]: 
          - generic [ref=e67]: Audit Logs
      - listitem [ref=e68]:
        - link " Notifications" [ref=e69] [cursor=pointer]:
          - /url: "#notifications"
          - generic [ref=e70]: 
          - generic [ref=e71]: Notifications
      - listitem [ref=e72]:
        - link " Chat & Support" [ref=e73] [cursor=pointer]:
          - /url: "#chat"
          - generic [ref=e74]: 
          - generic [ref=e75]: Chat & Support
      - listitem [ref=e76]:
        - link " My Profile" [ref=e77] [cursor=pointer]:
          - /url: "#profile"
          - generic [ref=e78]: 
          - generic [ref=e79]: My Profile
  - main [ref=e80]:
    - generic [ref=e81]:
      - heading "Products Catalog" [level=1] [ref=e82]
      - navigation [ref=e83]:
        - list [ref=e84]:
          - listitem [ref=e85]:
            - link "Home" [ref=e86] [cursor=pointer]:
              - /url: /
          - listitem [ref=e87]: / Products Catalog
    - text:                                     
    - generic [ref=e90]:
      - heading "Products Catalog  Add Product" [level=5] [ref=e91]:
        - generic [ref=e92]: Products Catalog
        - button " Add Product" [ref=e93] [cursor=pointer]:
          - generic [ref=e94]: 
          - generic [ref=e95]: Add Product
      - generic [ref=e96]:
        - generic [ref=e97]:
          - generic [ref=e98]: Category
          - combobox [ref=e99]:
            - option "All categories" [selected]
            - option "Agricultural Products"
            - option "Fruits"
            - option "Meat & Poultry"
            - option "Rice, Grains & Staples"
            - option "Vegetables"
        - generic [ref=e100]:
          - generic [ref=e101]: Status
          - combobox [ref=e102]:
            - option "All" [selected]
            - option "Active"
            - option "Disabled"
        - generic [ref=e103]:
          - generic [ref=e104]: Search
          - generic [ref=e105]:
            - generic [ref=e106]:
              - textbox "Product name…" [ref=e107]
              - button " Search" [ref=e108] [cursor=pointer]:
                - generic [ref=e109]: 
                - text: Search
            - button "" [ref=e110] [cursor=pointer]:
              - generic [ref=e111]: 
      - generic [ref=e112]:
        - generic [ref=e113]: Show
        - combobox [ref=e114]:
          - option "10"
          - option "25"
          - option "50" [selected]
          - option "100"
        - generic [ref=e115]: entries
      - table [ref=e119]:
        - rowgroup [ref=e120]:
          - row "ID NAME CATEGORY STATUS ACTIONS" [ref=e121]:
            - columnheader "ID" [ref=e122]:
              - button "ID" [ref=e123] [cursor=pointer]
            - columnheader "NAME" [ref=e124]:
              - button "NAME" [ref=e125] [cursor=pointer]
            - columnheader "CATEGORY" [ref=e126]:
              - button "CATEGORY" [ref=e127] [cursor=pointer]
            - columnheader "STATUS" [ref=e128]:
              - button "STATUS" [ref=e129] [cursor=pointer]
            - columnheader "ACTIONS" [ref=e130]
        - rowgroup [ref=e131]:
          - row "8 Ampalaya Vegetables Active Edit" [ref=e132]:
            - cell "8" [ref=e133]
            - cell "Ampalaya" [ref=e134]
            - cell "Vegetables" [ref=e135]
            - cell "Active" [ref=e136]
            - cell "Edit" [ref=e137]:
              - button "Edit" [ref=e138] [cursor=pointer]
          - row "78 Baboy - Atay Meat & Poultry Active Edit" [ref=e139]:
            - cell "78" [ref=e140]
            - cell "Baboy - Atay" [ref=e141]
            - cell "Meat & Poultry" [ref=e142]
            - cell "Active" [ref=e143]
            - cell "Edit" [ref=e144]:
              - button "Edit" [ref=e145] [cursor=pointer]
          - row "80 Baboy - Bituka Meat & Poultry Active Edit" [ref=e146]:
            - cell "80" [ref=e147]
            - cell "Baboy - Bituka" [ref=e148]
            - cell "Meat & Poultry" [ref=e149]
            - cell "Active" [ref=e150]
            - cell "Edit" [ref=e151]:
              - button "Edit" [ref=e152] [cursor=pointer]
          - row "71 Baboy - Kasim Meat & Poultry Active Edit" [ref=e153]:
            - cell "71" [ref=e154]
            - cell "Baboy - Kasim" [ref=e155]
            - cell "Meat & Poultry" [ref=e156]
            - cell "Active" [ref=e157]
            - cell "Edit" [ref=e158]:
              - button "Edit" [ref=e159] [cursor=pointer]
          - row "69 Baboy - Liempo Meat & Poultry Active Edit" [ref=e160]:
            - cell "69" [ref=e161]
            - cell "Baboy - Liempo" [ref=e162]
            - cell "Meat & Poultry" [ref=e163]
            - cell "Active" [ref=e164]
            - cell "Edit" [ref=e165]:
              - button "Edit" [ref=e166] [cursor=pointer]
          - row "73 Baboy - Pigue Meat & Poultry Active Edit" [ref=e167]:
            - cell "73" [ref=e168]
            - cell "Baboy - Pigue" [ref=e169]
            - cell "Meat & Poultry" [ref=e170]
            - cell "Active" [ref=e171]
            - cell "Edit" [ref=e172]:
              - button "Edit" [ref=e173] [cursor=pointer]
          - row "76 Baboy - Tadyang Meat & Poultry Active Edit" [ref=e174]:
            - cell "76" [ref=e175]
            - cell "Baboy - Tadyang" [ref=e176]
            - cell "Meat & Poultry" [ref=e177]
            - cell "Active" [ref=e178]
            - cell "Edit" [ref=e179]:
              - button "Edit" [ref=e180] [cursor=pointer]
          - row "89 Baka - Atay Meat & Poultry Active Edit" [ref=e181]:
            - cell "89" [ref=e182]
            - cell "Baka - Atay" [ref=e183]
            - cell "Meat & Poultry" [ref=e184]
            - cell "Active" [ref=e185]
            - cell "Edit" [ref=e186]:
              - button "Edit" [ref=e187] [cursor=pointer]
          - row "82 Baka - Brisket Meat & Poultry Active Edit" [ref=e188]:
            - cell "82" [ref=e189]
            - cell "Baka - Brisket" [ref=e190]
            - cell "Meat & Poultry" [ref=e191]
            - cell "Active" [ref=e192]
            - cell "Edit" [ref=e193]:
              - button "Edit" [ref=e194] [cursor=pointer]
          - row "85 Baka - Bulalo Meat & Poultry Active Edit" [ref=e195]:
            - cell "85" [ref=e196]
            - cell "Baka - Bulalo" [ref=e197]
            - cell "Meat & Poultry" [ref=e198]
            - cell "Active" [ref=e199]
            - cell "Edit" [ref=e200]:
              - button "Edit" [ref=e201] [cursor=pointer]
          - row "91 Baka - Goto Meat & Poultry Active Edit" [ref=e202]:
            - cell "91" [ref=e203]
            - cell "Baka - Goto" [ref=e204]
            - cell "Meat & Poultry" [ref=e205]
            - cell "Active" [ref=e206]
            - cell "Edit" [ref=e207]:
              - button "Edit" [ref=e208] [cursor=pointer]
          - row "87 Baka - Tadyang Meat & Poultry Active Edit" [ref=e209]:
            - cell "87" [ref=e210]
            - cell "Baka - Tadyang" [ref=e211]
            - cell "Meat & Poultry" [ref=e212]
            - cell "Active" [ref=e213]
            - cell "Edit" [ref=e214]:
              - button "Edit" [ref=e215] [cursor=pointer]
          - row "32 Bawang Vegetables Active Edit" [ref=e216]:
            - cell "32" [ref=e217]
            - cell "Bawang" [ref=e218]
            - cell "Vegetables" [ref=e219]
            - cell "Active" [ref=e220]
            - cell "Edit" [ref=e221]:
              - button "Edit" [ref=e222] [cursor=pointer]
          - row "52 Bayabas Fruits Active Edit" [ref=e223]:
            - cell "52" [ref=e224]
            - cell "Bayabas" [ref=e225]
            - cell "Fruits" [ref=e226]
            - cell "Active" [ref=e227]
            - cell "Edit" [ref=e228]:
              - button "Edit" [ref=e229] [cursor=pointer]
          - row "115 Brown rice Rice, Grains & Staples Active Edit" [ref=e230]:
            - cell "115" [ref=e231]
            - cell "Brown rice" [ref=e232]
            - cell "Rice, Grains & Staples" [ref=e233]
            - cell "Active" [ref=e234]
            - cell "Edit" [ref=e235]:
              - button "Edit" [ref=e236] [cursor=pointer]
          - row "64 Calamansi Fruits Active Edit" [ref=e237]:
            - cell "64" [ref=e238]
            - cell "Calamansi" [ref=e239]
            - cell "Fruits" [ref=e240]
            - cell "Active" [ref=e241]
            - cell "Edit" [ref=e242]:
              - button "Edit" [ref=e243] [cursor=pointer]
          - row "61 Chico Fruits Active Edit" [ref=e244]:
            - cell "61" [ref=e245]
            - cell "Chico" [ref=e246]
            - cell "Fruits" [ref=e247]
            - cell "Active" [ref=e248]
            - cell "Edit" [ref=e249]:
              - button "Edit" [ref=e250] [cursor=pointer]
          - row "67 Dalandan Fruits Active Edit" [ref=e251]:
            - cell "67" [ref=e252]
            - cell "Dalandan" [ref=e253]
            - cell "Fruits" [ref=e254]
            - cell "Active" [ref=e255]
            - cell "Edit" [ref=e256]:
              - button "Edit" [ref=e257] [cursor=pointer]
          - row "23 Gabi Vegetables Active Edit" [ref=e258]:
            - cell "23" [ref=e259]
            - cell "Gabi" [ref=e260]
            - cell "Vegetables" [ref=e261]
            - cell "Active" [ref=e262]
            - cell "Edit" [ref=e263]:
              - button "Edit" [ref=e264] [cursor=pointer]
          - row "109 Itik - Atay Meat & Poultry Active Edit" [ref=e265]:
            - cell "109" [ref=e266]
            - cell "Itik - Atay" [ref=e267]
            - cell "Meat & Poultry" [ref=e268]
            - cell "Active" [ref=e269]
            - cell "Edit" [ref=e270]:
              - button "Edit" [ref=e271] [cursor=pointer]
          - row "107 Itik - Buong itik Meat & Poultry Active Edit" [ref=e272]:
            - cell "107" [ref=e273]
            - cell "Itik - Buong itik" [ref=e274]
            - cell "Meat & Poultry" [ref=e275]
            - cell "Active" [ref=e276]
            - cell "Edit" [ref=e277]:
              - button "Edit" [ref=e278] [cursor=pointer]
          - row "10 Kalabasa Vegetables Active Edit" [ref=e279]:
            - cell "10" [ref=e280]
            - cell "Kalabasa" [ref=e281]
            - cell "Vegetables" [ref=e282]
            - cell "Active" [ref=e283]
            - cell "Edit" [ref=e284]:
              - button "Edit" [ref=e285] [cursor=pointer]
          - row "7 Kamatis Vegetables Active Edit" [ref=e286]:
            - cell "7" [ref=e287]
            - cell "Kamatis" [ref=e288]
            - cell "Vegetables" [ref=e289]
            - cell "Active" [ref=e290]
            - cell "Edit" [ref=e291]:
              - button "Edit" [ref=e292] [cursor=pointer]
          - row "21 Kamote Vegetables Active Edit" [ref=e293]:
            - cell "21" [ref=e294]
            - cell "Kamote" [ref=e295]
            - cell "Vegetables" [ref=e296]
            - cell "Active" [ref=e297]
            - cell "Edit" [ref=e298]:
              - button "Edit" [ref=e299] [cursor=pointer]
          - row "2 Kangkong Vegetables Active Edit" [ref=e300]:
            - cell "2" [ref=e301]
            - cell "Kangkong" [ref=e302]
            - cell "Vegetables" [ref=e303]
            - cell "Active" [ref=e304]
            - cell "Edit" [ref=e305]:
              - button "Edit" [ref=e306] [cursor=pointer]
          - row "27 Karot Vegetables Active Edit" [ref=e307]:
            - cell "27" [ref=e308]
            - cell "Karot" [ref=e309]
            - cell "Vegetables" [ref=e310]
            - cell "Active" [ref=e311]
            - cell "Edit" [ref=e312]:
              - button "Edit" [ref=e313] [cursor=pointer]
          - row "25 Labanos Vegetables Active Edit" [ref=e314]:
            - cell "25" [ref=e315]
            - cell "Labanos" [ref=e316]
            - cell "Vegetables" [ref=e317]
            - cell "Active" [ref=e318]
            - cell "Edit" [ref=e319]:
              - button "Edit" [ref=e320] [cursor=pointer]
          - row "57 Lanzones Fruits Active Edit" [ref=e321]:
            - cell "57" [ref=e322]
            - cell "Lanzones" [ref=e323]
            - cell "Fruits" [ref=e324]
            - cell "Active" [ref=e325]
            - cell "Edit" [ref=e326]:
              - button "Edit" [ref=e327] [cursor=pointer]
          - row "4 Letsugas Vegetables Active Edit" [ref=e328]:
            - cell "4" [ref=e329]
            - cell "Letsugas" [ref=e330]
            - cell "Vegetables" [ref=e331]
            - cell "Active" [ref=e332]
            - cell "Edit" [ref=e333]:
              - button "Edit" [ref=e334] [cursor=pointer]
          - row "35 Luya Vegetables Active Edit" [ref=e335]:
            - cell "35" [ref=e336]
            - cell "Luya" [ref=e337]
            - cell "Vegetables" [ref=e338]
            - cell "Active" [ref=e339]
            - cell "Edit" [ref=e340]:
              - button "Edit" [ref=e341] [cursor=pointer]
          - row "119 Mais Rice, Grains & Staples Active Edit" [ref=e342]:
            - cell "119" [ref=e343]
            - cell "Mais" [ref=e344]
            - cell "Rice, Grains & Staples" [ref=e345]
            - cell "Active" [ref=e346]
            - cell "Edit" [ref=e347]:
              - button "Edit" [ref=e348] [cursor=pointer]
          - row "117 Malagkit na bigas Rice, Grains & Staples Active Edit" [ref=e349]:
            - cell "117" [ref=e350]
            - cell "Malagkit na bigas" [ref=e351]
            - cell "Rice, Grains & Staples" [ref=e352]
            - cell "Active" [ref=e353]
            - cell "Edit" [ref=e354]:
              - button "Edit" [ref=e355] [cursor=pointer]
          - row "5 Malunggay Vegetables Active Edit" [ref=e356]:
            - cell "5" [ref=e357]
            - cell "Malunggay" [ref=e358]
            - cell "Vegetables" [ref=e359]
            - cell "Active" [ref=e360]
            - cell "Edit" [ref=e361]:
              - button "Edit" [ref=e362] [cursor=pointer]
          - row "41 Mangga Fruits Active Edit" [ref=e363]:
            - cell "41" [ref=e364]
            - cell "Mangga" [ref=e365]
            - cell "Fruits" [ref=e366]
            - cell "Active" [ref=e367]
            - cell "Edit" [ref=e368]:
              - button "Edit" [ref=e369] [cursor=pointer]
          - row "123 Mani Rice, Grains & Staples Active Edit" [ref=e370]:
            - cell "123" [ref=e371]
            - cell "Mani" [ref=e372]
            - cell "Rice, Grains & Staples" [ref=e373]
            - cell "Active" [ref=e374]
            - cell "Edit" [ref=e375]:
              - button "Edit" [ref=e376] [cursor=pointer]
          - row "103 Manok - Atay Meat & Poultry Active Edit" [ref=e377]:
            - cell "103" [ref=e378]
            - cell "Manok - Atay" [ref=e379]
            - cell "Meat & Poultry" [ref=e380]
            - cell "Active" [ref=e381]
            - cell "Edit" [ref=e382]:
              - button "Edit" [ref=e383] [cursor=pointer]
          - row "105 Manok - Balunbalunan Meat & Poultry Active Edit" [ref=e384]:
            - cell "105" [ref=e385]
            - cell "Manok - Balunbalunan" [ref=e386]
            - cell "Meat & Poultry" [ref=e387]
            - cell "Active" [ref=e388]
            - cell "Edit" [ref=e389]:
              - button "Edit" [ref=e390] [cursor=pointer]
          - row "93 Manok - Buong manok Meat & Poultry Active Edit" [ref=e391]:
            - cell "93" [ref=e392]
            - cell "Manok - Buong manok" [ref=e393]
            - cell "Meat & Poultry" [ref=e394]
            - cell "Active" [ref=e395]
            - cell "Edit" [ref=e396]:
              - button "Edit" [ref=e397] [cursor=pointer]
          - row "101 Manok - Dibdib Meat & Poultry Active Edit" [ref=e398]:
            - cell "101" [ref=e399]
            - cell "Manok - Dibdib" [ref=e400]
            - cell "Meat & Poultry" [ref=e401]
            - cell "Active" [ref=e402]
            - cell "Edit" [ref=e403]:
              - button "Edit" [ref=e404] [cursor=pointer]
          - row "99 Manok - Hita Meat & Poultry Active Edit" [ref=e405]:
            - cell "99" [ref=e406]
            - cell "Manok - Hita" [ref=e407]
            - cell "Meat & Poultry" [ref=e408]
            - cell "Active" [ref=e409]
            - cell "Edit" [ref=e410]:
              - button "Edit" [ref=e411] [cursor=pointer]
          - row "97 Manok - Paa Meat & Poultry Active Edit" [ref=e412]:
            - cell "97" [ref=e413]
            - cell "Manok - Paa" [ref=e414]
            - cell "Meat & Poultry" [ref=e415]
            - cell "Active" [ref=e416]
            - cell "Edit" [ref=e417]:
              - button "Edit" [ref=e418] [cursor=pointer]
          - row "95 Manok - Pakpak Meat & Poultry Active Edit" [ref=e419]:
            - cell "95" [ref=e420]
            - cell "Manok - Pakpak" [ref=e421]
            - cell "Meat & Poultry" [ref=e422]
            - cell "Active" [ref=e423]
            - cell "Edit" [ref=e424]:
              - button "Edit" [ref=e425] [cursor=pointer]
          - row "50 Melon Fruits Active Edit" [ref=e426]:
            - cell "50" [ref=e427]
            - cell "Melon" [ref=e428]
            - cell "Fruits" [ref=e429]
            - cell "Active" [ref=e430]
            - cell "Edit" [ref=e431]:
              - button "Edit" [ref=e432] [cursor=pointer]
          - row "121 Munggo Rice, Grains & Staples Active Edit" [ref=e433]:
            - cell "121" [ref=e434]
            - cell "Munggo" [ref=e435]
            - cell "Rice, Grains & Staples" [ref=e436]
            - cell "Active" [ref=e437]
            - cell "Edit" [ref=e438]:
              - button "Edit" [ref=e439] [cursor=pointer]
          - row "3 Mustasa Vegetables Active Edit" [ref=e440]:
            - cell "3" [ref=e441]
            - cell "Mustasa" [ref=e442]
            - cell "Vegetables" [ref=e443]
            - cell "Active" [ref=e444]
            - cell "Edit" [ref=e445]:
              - button "Edit" [ref=e446] [cursor=pointer]
          - row "9 Okra Vegetables Active Edit" [ref=e447]:
            - cell "9" [ref=e448]
            - cell "Okra" [ref=e449]
            - cell "Vegetables" [ref=e450]
            - cell "Active" [ref=e451]
            - cell "Edit" [ref=e452]:
              - button "Edit" [ref=e453] [cursor=pointer]
          - row "48 Pakwan Fruits Active Edit" [ref=e454]:
            - cell "48" [ref=e455]
            - cell "Pakwan" [ref=e456]
            - cell "Fruits" [ref=e457]
            - cell "Active" [ref=e458]
            - cell "Edit" [ref=e459]:
              - button "Edit" [ref=e460] [cursor=pointer]
          - row "44 Papaya Fruits Active Edit" [ref=e461]:
            - cell "44" [ref=e462]
            - cell "Papaya" [ref=e463]
            - cell "Fruits" [ref=e464]
            - cell "Active" [ref=e465]
            - cell "Edit" [ref=e466]:
              - button "Edit" [ref=e467] [cursor=pointer]
          - row "18 Patatas Vegetables Active Edit" [ref=e468]:
            - cell "18" [ref=e469]
            - cell "Patatas" [ref=e470]
            - cell "Vegetables" [ref=e471]
            - cell "Active" [ref=e472]
            - cell "Edit" [ref=e473]:
              - button "Edit" [ref=e474] [cursor=pointer]
          - row "16 Patola Vegetables Active Edit" [ref=e475]:
            - cell "16" [ref=e476]
            - cell "Patola" [ref=e477]
            - cell "Vegetables" [ref=e478]
            - cell "Active" [ref=e479]
            - cell "Edit" [ref=e480]:
              - button "Edit" [ref=e481] [cursor=pointer]
      - generic [ref=e482]:
        - generic [ref=e483]: Showing 1–50 of 64
        - generic [ref=e484]:
          - button "‹" [disabled]
          - button "1" [ref=e485] [cursor=pointer]
          - button "2" [ref=e486] [cursor=pointer]
          - button "›" [ref=e487] [cursor=pointer]
    - text:             
  - text:    
  - text:           
  - img
```

# Test source

```ts
  38  |   test('Products table Edit button should be clickable', async ({ page }) => {
  39  |     const { token } = await getAdminToken();
  40  |     await page.goto('/admin.html');
  41  |     await page.evaluate((authToken) => {
  42  |       localStorage.setItem('token', authToken);
  43  |     }, token);
  44  |     await page.reload();
  45  |     await page.waitForTimeout(3000);
  46  |     
  47  |     await page.evaluate(() => {
  48  |       const link = document.querySelector('[data-section="products"]');
  49  |       if (link) link.click();
  50  |     });
  51  |     await page.waitForSelector('#products-tbody', { timeout: 10000 });
  52  |     await page.waitForTimeout(1000);
  53  |     
  54  |     const editButton = page.locator('#products-tbody .product-edit-btn').first();
  55  |     await expect(editButton).toBeVisible();
  56  |     await expect(editButton).toBeEnabled();
  57  |     
  58  |     await editButton.click();
  59  |     await expect(page.locator('#product-edit-modal')).toHaveClass(/open/);
  60  |     
  61  |     await page.evaluate(() => {
  62  |       const modal = document.querySelector('#product-edit-modal');
  63  |       if (modal) modal.classList.remove('open');
  64  |     });
  65  |   });
  66  | 
  67  |   test('Orders table View button should be clickable', async ({ page }) => {
  68  |     const { token } = await getAdminToken();
  69  |     await page.goto('/admin.html');
  70  |     await page.evaluate((authToken) => {
  71  |       localStorage.setItem('token', authToken);
  72  |     }, token);
  73  |     await page.reload();
  74  |     await page.waitForTimeout(3000);
  75  |     
  76  |     await page.evaluate(() => {
  77  |       const link = document.querySelector('[data-section="orders"]');
  78  |       if (link) link.click();
  79  |     });
  80  |     await page.waitForSelector('#orders-tbody', { timeout: 10000 });
  81  |     await page.waitForTimeout(1000);
  82  |     
  83  |     const viewButton = page.locator('#orders-tbody .order-view-btn').first();
  84  |     await expect(viewButton).toBeVisible();
  85  |     await expect(viewButton).toBeEnabled();
  86  |     
  87  |     await viewButton.click();
  88  |     await expect(page.locator('#order-detail-panel')).toHaveClass(/active/);
  89  |     
  90  |     await page.evaluate(() => {
  91  |       const panel = document.querySelector('#order-detail-panel');
  92  |       if (panel) panel.classList.remove('active');
  93  |     });
  94  |   });
  95  | 
  96  |   test('Categories table Edit button should be clickable', async ({ page }) => {
  97  |     const { token } = await getAdminToken();
  98  |     await page.goto('/admin.html');
  99  |     await page.evaluate((authToken) => {
  100 |       localStorage.setItem('token', authToken);
  101 |     }, token);
  102 |     await page.reload();
  103 |     await page.waitForTimeout(3000);
  104 |     
  105 |     await page.evaluate(() => {
  106 |       const link = document.querySelector('[data-section="categories"]');
  107 |       if (link) link.click();
  108 |     });
  109 |     await page.waitForSelector('#categories-tbody', { timeout: 10000 });
  110 |     await page.waitForTimeout(1000);
  111 |     
  112 |     const editButton = page.locator('#categories-tbody .category-edit-btn').first();
  113 |     await expect(editButton).toBeVisible();
  114 |     await expect(editButton).toBeEnabled();
  115 |     
  116 |     await editButton.click();
  117 |     await expect(page.locator('#category-edit-modal')).toHaveClass(/open/);
  118 |     
  119 |     await page.evaluate(() => {
  120 |       const modal = document.querySelector('#category-edit-modal');
  121 |       if (modal) modal.classList.remove('open');
  122 |     });
  123 |   });
  124 | 
  125 |   test('Catalog table Edit button should be clickable', async ({ page }) => {
  126 |     const { token } = await getAdminToken();
  127 |     await page.goto('/admin.html');
  128 |     await page.evaluate((authToken) => {
  129 |       localStorage.setItem('token', authToken);
  130 |     }, token);
  131 |     await page.reload();
  132 |     await page.waitForTimeout(3000);
  133 |     
  134 |     await page.evaluate(() => {
  135 |       const link = document.querySelector('[data-section="catalog-products"]');
  136 |       if (link) link.click();
  137 |     });
> 138 |     await page.waitForSelector('#catalog-products-tbody', { timeout: 10000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  139 |     await page.waitForTimeout(1000);
  140 |     
  141 |     const editButton = page.locator('#catalog-products-tbody .catalog-edit-btn').first();
  142 |     await expect(editButton).toBeVisible();
  143 |     await expect(editButton).toBeEnabled();
  144 |     
  145 |     await editButton.click();
  146 |     await expect(page.locator('#catalog-edit-modal')).toHaveClass(/open/);
  147 |     
  148 |     await page.evaluate(() => {
  149 |       const modal = document.querySelector('#catalog-edit-modal');
  150 |       if (modal) modal.classList.remove('open');
  151 |     });
  152 |   });
  153 | });
  154 | 
```