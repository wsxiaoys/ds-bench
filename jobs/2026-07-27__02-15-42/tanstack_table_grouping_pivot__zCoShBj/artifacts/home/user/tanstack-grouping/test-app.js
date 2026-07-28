import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting puppeteer test...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    // Navigate to local dev server
    await page.goto('http://localhost:5319/', { waitUntil: 'domcontentloaded' });
    console.log('Page loaded successfully!');

    // 1. Verify Grand Total Footer
    const grandTotal = await page.$eval('[data-testid="grand-total-amount"]', el => el.textContent.trim());
    console.log(`Grand Total: ${grandTotal}`);
    if (grandTotal !== '10800') {
      throw new Error(`Expected grand total to be 10800, got ${grandTotal}`);
    }

    // 2. Verify Leftmost column pinning
    const pinnedHeader = await page.$('[data-testid="pinned-col-header"]');
    if (!pinnedHeader) {
      throw new Error('Could not find pinned column header with data-testid="pinned-col-header"');
    }
    const pinnedStyles = await page.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        position: style.position,
        left: style.left
      };
    }, pinnedHeader);
    console.log(`Pinned column styles: position=${pinnedStyles.position}, left=${pinnedStyles.left}`);
    if (pinnedStyles.position !== 'sticky' || pinnedStyles.left !== '0px') {
      throw new Error(`Expected pinned column to be sticky and left 0px, got position=${pinnedStyles.position}, left=${pinnedStyles.left}`);
    }

    // 3. Verify Leaf rows when Grouping is 'none'
    let dataRows = await page.$$('[data-testid="data-row"]');
    console.log(`Number of data rows when grouping is 'none': ${dataRows.length}`);
    if (dataRows.length !== 12) {
      throw new Error(`Expected 12 data rows when grouping is 'none', got ${dataRows.length}`);
    }

    // Check one of the amounts
    const firstAmount = await page.$eval('[data-testid="cell-amount"]', el => el.textContent.trim());
    console.log(`First cell amount: ${firstAmount}`);
    if (firstAmount !== '1200') {
      throw new Error(`Expected first cell amount to be 1200, got ${firstAmount}`);
    }

    // 4. Change Grouping to 'region'
    console.log('Changing grouping to "region"...');
    await page.select('[data-testid="group-by"]', 'region');
    await new Promise(resolve => setTimeout(resolve, 500)); // wait for state update

    // Check that all groups start collapsed (no data rows visible)
    dataRows = await page.$$('[data-testid="data-row"]');
    console.log(`Number of visible data rows after grouping by region (collapsed): ${dataRows.length}`);
    if (dataRows.length !== 0) {
      throw new Error(`Expected 0 visible data rows when groups are collapsed, got ${dataRows.length}`);
    }

    // Verify group rows
    let groupRows = await page.$$('[data-testid="group-row"]');
    console.log(`Number of group rows: ${groupRows.length}`);
    if (groupRows.length !== 3) {
      throw new Error(`Expected 3 group rows (North, South, East), got ${groupRows.length}`);
    }

    // Extract group row details
    let groupData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-testid="group-row"]'));
      return rows.map(r => {
        const value = r.getAttribute('data-group-value');
        const sum = r.querySelector('[data-testid="group-sum-amount"]').textContent.trim();
        const avg = r.querySelector('[data-testid="group-avg-unit-price"]').textContent.trim();
        const count = r.querySelector('[data-testid="group-count"]').textContent.trim();
        return { value, sum, avg, count };
      });
    });

    console.log('Group rows data (default order):', groupData);
    
    // Expected default order: North, South, East
    const expectedDefault = [
      { value: 'North', sum: '3300', avg: '32.5', count: '4' },
      { value: 'South', sum: '3500', avg: '31.25', count: '4' },
      { value: 'East', sum: '4000', avg: '34.75', count: '4' }
    ];

    for (let i = 0; i < 3; i++) {
      if (groupData[i].value !== expectedDefault[i].value ||
          groupData[i].sum !== expectedDefault[i].sum ||
          parseFloat(groupData[i].avg) !== parseFloat(expectedDefault[i].avg) ||
          groupData[i].count !== expectedDefault[i].count) {
        throw new Error(`Mismatch at group index ${i}. Got: ${JSON.stringify(groupData[i])}, Expected: ${JSON.stringify(expectedDefault[i])}`);
      }
    }

    // 5. Expand North Group
    console.log('Expanding "North" group...');
    const toggleButtons = await page.$$('[data-testid="group-toggle"]');
    await toggleButtons[0].click(); // click North toggle
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify child data rows are visible
    dataRows = await page.$$('[data-testid="data-row"]');
    console.log(`Number of visible data rows after expanding North: ${dataRows.length}`);
    if (dataRows.length !== 4) {
      throw new Error(`Expected 4 visible data rows for North group, got ${dataRows.length}`);
    }

    // Verify data-group-value of visible data rows
    const dataRowGroupValues = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-testid="data-row"]'));
      return rows.map(r => r.getAttribute('data-group-value'));
    });
    console.log('Visible data rows group values:', dataRowGroupValues);
    if (dataRowGroupValues.some(v => v !== 'North')) {
      throw new Error(`Expected all visible data rows to have data-group-value="North", got ${JSON.stringify(dataRowGroupValues)}`);
    }

    // Collapse North Group again
    console.log('Collapsing "North" group...');
    await toggleButtons[0].click();
    await new Promise(resolve => setTimeout(resolve, 500));
    dataRows = await page.$$('[data-testid="data-row"]');
    if (dataRows.length !== 0) {
      throw new Error(`Expected 0 visible data rows after collapsing North group, got ${dataRows.length}`);
    }

    // 6. Sort Groups Ascending
    console.log('Sorting groups by Amount Ascending...');
    await page.select('[data-testid="sort-groups"]', 'asc');
    await new Promise(resolve => setTimeout(resolve, 500));

    groupData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-testid="group-row"]'));
      return rows.map(r => ({
        value: r.getAttribute('data-group-value'),
        sum: r.querySelector('[data-testid="group-sum-amount"]').textContent.trim()
      }));
    });
    console.log('Sorted Ascending Group Data:', groupData);
    if (groupData[0].value !== 'North' || groupData[1].value !== 'South' || groupData[2].value !== 'East') {
      throw new Error(`Groups are not sorted correctly in ascending order. Got: ${JSON.stringify(groupData)}`);
    }

    // 7. Sort Groups Descending
    console.log('Sorting groups by Amount Descending...');
    await page.select('[data-testid="sort-groups"]', 'desc');
    await new Promise(resolve => setTimeout(resolve, 500));

    groupData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-testid="group-row"]'));
      return rows.map(r => ({
        value: r.getAttribute('data-group-value'),
        sum: r.querySelector('[data-testid="group-sum-amount"]').textContent.trim()
      }));
    });
    console.log('Sorted Descending Group Data:', groupData);
    if (groupData[0].value !== 'East' || groupData[1].value !== 'South' || groupData[2].value !== 'North') {
      throw new Error(`Groups are not sorted correctly in descending order. Got: ${JSON.stringify(groupData)}`);
    }

    // 8. Change Grouping to 'category'
    console.log('Changing grouping to "category"...');
    await page.select('[data-testid="group-by"]', 'category');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reset sorting to none to check default category order
    console.log('Resetting sorting to "none"...');
    await page.select('[data-testid="sort-groups"]', 'none');
    await new Promise(resolve => setTimeout(resolve, 500));

    groupRows = await page.$$('[data-testid="group-row"]');
    console.log(`Number of group rows for category: ${groupRows.length}`);
    if (groupRows.length !== 2) {
      throw new Error(`Expected 2 group rows for category, got ${groupRows.length}`);
    }

    groupData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-testid="group-row"]'));
      return rows.map(r => {
        const value = r.getAttribute('data-group-value');
        const sum = r.querySelector('[data-testid="group-sum-amount"]').textContent.trim();
        const avg = r.querySelector('[data-testid="group-avg-unit-price"]').textContent.trim();
        const count = r.querySelector('[data-testid="group-count"]').textContent.trim();
        return { value, sum, avg, count };
      });
    });
    console.log('Category Group rows data (default order):', groupData);

    const expectedCategoryDefault = [
      { value: 'Widgets', sum: '6300', avg: '30', count: '6' },
      { value: 'Gadgets', sum: '4500', avg: '35.6667', count: '6' }
    ];

    for (let i = 0; i < 2; i++) {
      if (groupData[i].value !== expectedCategoryDefault[i].value ||
          groupData[i].sum !== expectedCategoryDefault[i].sum ||
          Math.abs(parseFloat(groupData[i].avg) - parseFloat(expectedCategoryDefault[i].avg)) > 0.01 ||
          groupData[i].count !== expectedCategoryDefault[i].count) {
        throw new Error(`Mismatch at category index ${i}. Got: ${JSON.stringify(groupData[i])}, Expected: ${JSON.stringify(expectedCategoryDefault[i])}`);
      }
    }

    // 9. Sort Category Groups Ascending
    console.log('Sorting category groups by Amount Ascending...');
    await page.select('[data-testid="sort-groups"]', 'asc');
    await new Promise(resolve => setTimeout(resolve, 500));

    groupData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-testid="group-row"]'));
      return rows.map(r => ({
        value: r.getAttribute('data-group-value'),
        sum: r.querySelector('[data-testid="group-sum-amount"]').textContent.trim()
      }));
    });
    console.log('Sorted Ascending Category Group Data:', groupData);
    if (groupData[0].value !== 'Gadgets' || groupData[1].value !== 'Widgets') {
      throw new Error(`Category groups are not sorted correctly in ascending order. Got: ${JSON.stringify(groupData)}`);
    }

    // 10. Sort Category Groups Descending
    console.log('Sorting category groups by Amount Descending...');
    await page.select('[data-testid="sort-groups"]', 'desc');
    await new Promise(resolve => setTimeout(resolve, 500));

    groupData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-testid="group-row"]'));
      return rows.map(r => ({
        value: r.getAttribute('data-group-value'),
        sum: r.querySelector('[data-testid="group-sum-amount"]').textContent.trim()
      }));
    });
    console.log('Sorted Descending Category Group Data:', groupData);
    if (groupData[0].value !== 'Widgets' || groupData[1].value !== 'Gadgets') {
      throw new Error(`Category groups are not sorted correctly in descending order. Got: ${JSON.stringify(groupData)}`);
    }

    console.log('All tests passed successfully! Perfect compliance.');

  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
