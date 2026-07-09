# Admin Orders Export Audit Report

**Date**: 2026-07-09T07:57:26.260Z
**Service**: D:/Codings/AgriCatch/backend/services/orderExportService.js
**Sample export saved to**: D:/Codings/AgriCatch/test-downloads/Admin_Orders_Audit_Export.xlsx

## Overall Result: FUNCTIONAL PASS, EXCEL FORMATTING FAIL

- **Functional (data integrity)**: PASS — exported rows, IDs, totals, and revenue match the filtered source for all tested combinations.
- **Excel formatting**: FAIL — footer text is not present in the workbook.

## Test Results Summary

| # | Test | Params | UI/API Rows | Export Rows | UI/API Revenue | Export Revenue | ID Set Match | Order Match | Status |
|---|------|--------|-------------|-------------|----------------|----------------|--------------|-------------|--------|
| 1 | Search only | search=a | 261 | 261 | 55764.90 | ₱55,764.90 | Yes | Yes | PASS |
| 2 | Status only | status=pending | 191 | 191 | 42907.95 | ₱42,907.95 | Yes | Yes | PASS |
| 3 | Date range only | date_from=2026-06-28, date_to=2026-07-09 | 275 | 275 | 56123.90 | ₱56,123.90 | Yes | Yes | PASS |
| 4 | Search + Status | search=a, status=pending | 187 | 187 | 42627.95 | ₱42,627.95 | Yes | Yes | PASS |
| 5 | Search + Date | search=a, date_from=2026-06-28, date_to=2026-07-09 | 261 | 261 | 55764.90 | ₱55,764.90 | Yes | Yes | PASS |
| 6 | Status + Date | status=pending, date_from=2026-06-28, date_to=2026-07-09 | 191 | 191 | 42907.95 | ₱42,907.95 | Yes | Yes | PASS |
| 7 | Search + Status + Date | search=a, status=pending, date_from=2026-06-28, date_to=2026-07-09 | 187 | 187 | 42627.95 | ₱42,627.95 | Yes | Yes | PASS |
| 8 | Sort: date_desc | sort=date_desc | 275 | 275 | 56123.90 | ₱56,123.90 | Yes | Yes | PASS |
| 9 | Sort: date_asc | sort=date_asc | 275 | 275 | 56123.90 | ₱56,123.90 | Yes | Yes | PASS |
| 10 | Sort: total_desc | sort=total_desc | 275 | 275 | 56123.90 | ₱56,123.90 | Yes | Yes | PASS |
| 11 | Sort: total_asc | sort=total_asc | 275 | 275 | 56123.90 | ₱56,123.90 | Yes | Yes | PASS |
| 12 | Sort: id_desc | sort=id_desc | 275 | 275 | 56123.90 | ₱56,123.90 | Yes | Yes | PASS |
| 13 | Sort: id_asc | sort=id_asc | 275 | 275 | 56123.90 | ₱56,123.90 | Yes | Yes | PASS |
| 14 | Sort: customer_asc | sort=customer_asc | 275 | 275 | 56123.90 | ₱56,123.90 | Yes | Yes | PASS |
| 15 | Sort: customer_desc | sort=customer_desc | 275 | 275 | 56123.90 | ₱56,123.90 | Yes | Yes | PASS |
| 16 | Sort: status_asc | sort=status_asc | 275 | 275 | 56123.90 | ₱56,123.90 | Yes | Yes | PASS |
| 17 | Sort: status_desc | sort=status_desc | 275 | 275 | 56123.90 | ₱56,123.90 | Yes | Yes | PASS |
| 18 | Pagination test | status=pending | 191 | 191 | 42907.95 | ₱42,907.95 | Yes | Yes | PASS |

### Search only
- **Params**: {"search":"a"}
- **UI/API total row count**: 261
- **API all rows (limit=0)**: 261
- **Export row count**: 261
- **UI/API total revenue**: 55764.90
- **Export total revenue**: 55764.90
- **Export summary total orders**: 261
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 385, 386, 384, 383, 382, 381, 380, 379, 378, 377
- **Export IDs (first 10)**: 385, 386, 384, 383, 382, 381, 380, 379, 378, 377
- **Errors**: None

### Status only
- **Params**: {"status":"pending"}
- **UI/API total row count**: 191
- **API all rows (limit=0)**: 191
- **Export row count**: 191
- **UI/API total revenue**: 42907.95
- **Export total revenue**: 42907.95
- **Export summary total orders**: 191
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 385, 384, 383, 382, 380, 379, 378, 377, 376, 375
- **Export IDs (first 10)**: 385, 384, 383, 382, 380, 379, 378, 377, 376, 375
- **Errors**: None

### Date range only
- **Params**: {"date_from":"2026-06-28","date_to":"2026-07-09"}
- **UI/API total row count**: 275
- **API all rows (limit=0)**: 275
- **Export row count**: 275
- **UI/API total revenue**: 56123.90
- **Export total revenue**: 56123.90
- **Export summary total orders**: 275
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 385, 386, 384, 383, 382, 381, 380, 379, 378, 377
- **Export IDs (first 10)**: 385, 386, 384, 383, 382, 381, 380, 379, 378, 377
- **Errors**: None

### Search + Status
- **Params**: {"search":"a","status":"pending"}
- **UI/API total row count**: 187
- **API all rows (limit=0)**: 187
- **Export row count**: 187
- **UI/API total revenue**: 42627.95
- **Export total revenue**: 42627.95
- **Export summary total orders**: 187
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 385, 384, 383, 382, 380, 379, 378, 377, 376, 375
- **Export IDs (first 10)**: 385, 384, 383, 382, 380, 379, 378, 377, 376, 375
- **Errors**: None

### Search + Date
- **Params**: {"search":"a","date_from":"2026-06-28","date_to":"2026-07-09"}
- **UI/API total row count**: 261
- **API all rows (limit=0)**: 261
- **Export row count**: 261
- **UI/API total revenue**: 55764.90
- **Export total revenue**: 55764.90
- **Export summary total orders**: 261
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 385, 386, 384, 383, 382, 381, 380, 379, 378, 377
- **Export IDs (first 10)**: 385, 386, 384, 383, 382, 381, 380, 379, 378, 377
- **Errors**: None

### Status + Date
- **Params**: {"status":"pending","date_from":"2026-06-28","date_to":"2026-07-09"}
- **UI/API total row count**: 191
- **API all rows (limit=0)**: 191
- **Export row count**: 191
- **UI/API total revenue**: 42907.95
- **Export total revenue**: 42907.95
- **Export summary total orders**: 191
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 385, 384, 383, 382, 380, 379, 378, 377, 376, 375
- **Export IDs (first 10)**: 385, 384, 383, 382, 380, 379, 378, 377, 376, 375
- **Errors**: None

### Search + Status + Date
- **Params**: {"search":"a","status":"pending","date_from":"2026-06-28","date_to":"2026-07-09"}
- **UI/API total row count**: 187
- **API all rows (limit=0)**: 187
- **Export row count**: 187
- **UI/API total revenue**: 42627.95
- **Export total revenue**: 42627.95
- **Export summary total orders**: 187
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 385, 384, 383, 382, 380, 379, 378, 377, 376, 375
- **Export IDs (first 10)**: 385, 384, 383, 382, 380, 379, 378, 377, 376, 375
- **Errors**: None

### Sort: date_desc
- **Params**: {"sort":"date_desc"}
- **UI/API total row count**: 275
- **API all rows (limit=0)**: 275
- **Export row count**: 275
- **UI/API total revenue**: 56123.90
- **Export total revenue**: 56123.90
- **Export summary total orders**: 275
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 385, 386, 384, 383, 382, 381, 380, 379, 378, 377
- **Export IDs (first 10)**: 385, 386, 384, 383, 382, 381, 380, 379, 378, 377
- **Errors**: None

### Sort: date_asc
- **Params**: {"sort":"date_asc"}
- **UI/API total row count**: 275
- **API all rows (limit=0)**: 275
- **Export row count**: 275
- **UI/API total revenue**: 56123.90
- **Export total revenue**: 56123.90
- **Export summary total orders**: 275
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 1, 3, 4, 5, 6, 7, 8, 9, 10, 16
- **Export IDs (first 10)**: 1, 3, 4, 5, 6, 7, 8, 9, 10, 16
- **Errors**: None

### Sort: total_desc
- **Params**: {"sort":"total_desc"}
- **UI/API total row count**: 275
- **API all rows (limit=0)**: 275
- **Export row count**: 275
- **UI/API total revenue**: 56123.90
- **Export total revenue**: 56123.90
- **Export summary total orders**: 275
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 127, 18, 95, 17, 129, 9, 288, 303, 16, 20
- **Export IDs (first 10)**: 127, 18, 95, 17, 129, 9, 288, 303, 16, 20
- **Errors**: None

### Sort: total_asc
- **Params**: {"sort":"total_asc"}
- **UI/API total row count**: 275
- **API all rows (limit=0)**: 275
- **Export row count**: 275
- **UI/API total revenue**: 56123.90
- **Export total revenue**: 56123.90
- **Export summary total orders**: 275
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 10, 296, 42, 299, 120, 112, 74, 285, 348, 338
- **Export IDs (first 10)**: 10, 296, 42, 299, 120, 112, 74, 285, 348, 338
- **Errors**: None

### Sort: id_desc
- **Params**: {"sort":"id_desc"}
- **UI/API total row count**: 275
- **API all rows (limit=0)**: 275
- **Export row count**: 275
- **UI/API total revenue**: 56123.90
- **Export total revenue**: 56123.90
- **Export summary total orders**: 275
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 386, 385, 384, 383, 382, 381, 380, 379, 378, 377
- **Export IDs (first 10)**: 386, 385, 384, 383, 382, 381, 380, 379, 378, 377
- **Errors**: None

### Sort: id_asc
- **Params**: {"sort":"id_asc"}
- **UI/API total row count**: 275
- **API all rows (limit=0)**: 275
- **Export row count**: 275
- **UI/API total revenue**: 56123.90
- **Export total revenue**: 56123.90
- **Export summary total orders**: 275
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 1, 3, 4, 5, 6, 7, 8, 9, 10, 16
- **Export IDs (first 10)**: 1, 3, 4, 5, 6, 7, 8, 9, 10, 16
- **Errors**: None

### Sort: customer_asc
- **Params**: {"sort":"customer_asc"}
- **UI/API total row count**: 275
- **API all rows (limit=0)**: 275
- **Export row count**: 275
- **UI/API total revenue**: 56123.90
- **Export total revenue**: 56123.90
- **Export summary total orders**: 275
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 342, 351, 316, 345, 374, 317, 320, 323, 319, 348
- **Export IDs (first 10)**: 342, 351, 316, 345, 374, 317, 320, 323, 319, 348
- **Errors**: None

### Sort: customer_desc
- **Params**: {"sort":"customer_desc"}
- **UI/API total row count**: 275
- **API all rows (limit=0)**: 275
- **Export row count**: 275
- **UI/API total revenue**: 56123.90
- **Export total revenue**: 56123.90
- **Export summary total orders**: 275
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 153, 288, 182, 289, 204, 244, 294, 206, 185, 295
- **Export IDs (first 10)**: 153, 288, 182, 289, 204, 244, 294, 206, 185, 295
- **Errors**: None

### Sort: status_asc
- **Params**: {"sort":"status_asc"}
- **UI/API total row count**: 275
- **API all rows (limit=0)**: 275
- **Export row count**: 275
- **UI/API total revenue**: 56123.90
- **Export total revenue**: 56123.90
- **Export summary total orders**: 275
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 305, 42, 128, 112, 5, 43, 6, 113, 4, 10
- **Export IDs (first 10)**: 305, 42, 128, 112, 5, 43, 6, 113, 4, 10
- **Errors**: None

### Sort: status_desc
- **Params**: {"sort":"status_desc"}
- **UI/API total row count**: 275
- **API all rows (limit=0)**: 275
- **Export row count**: 275
- **UI/API total revenue**: 56123.90
- **Export total revenue**: 56123.90
- **Export summary total orders**: 275
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 386, 184, 28, 26, 25, 27, 121, 335, 325, 16
- **Export IDs (first 10)**: 386, 184, 28, 26, 25, 27, 121, 335, 325, 16
- **Errors**: None

### Pagination test
- **Params**: {"status":"pending"} pagination={"page":"2","limit":"10"}
- **UI/API total row count**: 191
- **API all rows (limit=0)**: 191
- **Export row count**: 191
- **UI/API total revenue**: 42907.95
- **Export total revenue**: 42907.95
- **Export summary total orders**: 191
- **ID set match**: Yes
- **Order match**: Yes
- **Status**: PASS
- **API IDs (first 10)**: 385, 384, 383, 382, 380, 379, 378, 377, 376, 375
- **Export IDs (first 10)**: 385, 384, 383, 382, 380, 379, 378, 377, 376, 375
- **Errors**: None

## Excel Workbook Verification

- **Worksheet name**: Orders Report
- **Worksheet row count**: 287
- **Logo image present**: Yes (1 image(s))
- **Summary section found**: Yes
- **Summary values**: Total Orders=261, Total Revenue=₱55,764.90, Delivered=13, Pending=185, Cancelled=19
- **Generated By section found**: Yes
- **Generated By**: Name=Test Admin, Email=testadmin@test.com, Phone=N/A, Role=Administrator
- **Footer rows found**: 0
- **Column widths**: 12, 25, 25, 30, 12, 15, 15, 18, 20, 18, 18
- **Header borders sample**: {"left":{"style":"thin"},"right":{"style":"thin"},"top":{"style":"thin"},"bottom":{"style":"thin"}}
- **Data borders sample**: {"left":{"style":"thin"},"right":{"style":"thin"},"top":{"style":"thin"},"bottom":{"style":"thin"}}
- **Currency/date samples**:
  - Order #385: UnitPrice=₱45.00, Total=₱45.00, OrderDate=Jun 29, 2026, DeliveryDate=—
  - Order #386: UnitPrice=₱63.00, Total=₱63.00, OrderDate=Jun 29, 2026, DeliveryDate=Jul 2, 2026
  - Order #384: UnitPrice=₱42.00, Total=₱42.00, OrderDate=Jun 29, 2026, DeliveryDate=—
## Manual Excel Inspection Checklist

| Check | Expected | Observed | Status |
|-------|----------|----------|--------|
| Logo | Workbook contains a logo image | 1 image present | PASS |
| Summary | Total Orders, Total Revenue, Delivered, Pending, Cancelled | Values present and match totals (e.g., Total Orders=261, Total Revenue=₱55,764.90) | PASS |
| Formatting | Headers styled, data formatted | Header and data cells have thin borders, alignment applied | PASS |
| Currency | Unit Price and Order Total prefixed with ₱ | Values like ₱45.00, ₱55,764.90 | PASS |
| Dates | Order Date and Delivery Date readable | e.g., Jun 29, 2026, Jul 2, 2026 | PASS |
| Borders | Header and data cells have borders | thin borders on all sides | PASS |
| Footer | Generated by / Copyright text | No footer text found in workbook | FAIL |
| Column widths | Defined for all 11 columns | 12, 25, 25, 30, 12, 15, 15, 18, 20, 18, 18 | PASS |
| No repair warning | File opens without Excel repair dialog | ExcelJS and SheetJS load workbook without errors | PASS |

**Manual open note**: The workbook was inspected programmatically with ExcelJS and SheetJS because the environment does not expose a UI screenshot of Microsoft Excel. Both libraries opened the file without parse errors, indicating the file is not corrupt and no Excel repair warning is raised.

**Formatting failure detail**: The footer code (`ws.addRow(['', 'Generated by AgriCatch Platform'])` followed by `ws.mergeCells(row, 1, row, COL_COUNT)`) places the text in a non-master cell of the merged range, so the value is discarded when Excel writes the file. The footer cells are empty in the generated workbook.
