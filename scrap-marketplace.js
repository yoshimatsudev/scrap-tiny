// puppeteer-extra is a drop-in replacement for puppeteer,
// it augments the installed puppeteer with plugin functionality
const puppeteer = require('puppeteer-extra')
const cron = require('node-cron')
const locateChrome = require('locate-chrome')

// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

console.log('starting nodejs script')


async function getInvoices() {
    try {
        // const executablePath = await new Promise(resolve => locateChrome((arg) => resolve(arg))) || '';

        const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
        const page = await browser.newPage();

        await page.goto('https://erp.tiny.com.br/')
        await page.waitForTimeout(500)
        console.log('here')
        console.log(process.env.USERNAME)
        await page.type('input[name=username]', process.env.USERNAME);
        await page.waitForTimeout(500)
        await page.type('input[name=password]', process.env.PASSWORD);
        await page.waitForTimeout(500)
        console.log('here2')
        await page.click('html > body > div > div:nth-of-type(2) > div > div > react-login > div > div > div:first-of-type > div:first-of-type > div:first-of-type > form > div:nth-of-type(3) > button');

        await page.waitForSelector('.modal-footer > button:nth-of-type(1)')
        await page.waitForTimeout(500);

        await page.click('.modal-footer > button:nth-of-type(1)');

        console.log('here3')
        await page.waitForSelector('div[id=main-menu]');

        await page.goto('https://erp.tiny.com.br/notas_fiscais#list');

        await page.waitForSelector('#sit-P');
        await page.waitForTimeout(2000);
        await page.$eval('#sit-P', el => el.click());
        // await page.waitForTimeout(5000)


        await page.waitForTimeout(1500);

       
        const tableData = await page.$$eval('tr[idnota]', (rows, atr) => {
            return rows.map(row => {
                let storeData = row.querySelector('.badge-ecommerce > img').getAttribute('alt')
                let invoiceId = row.getAttribute(atr)


                return { id: invoiceId, store: storeData }
            });
        }, 'idnota');

        // console.log(tableData[0], storeEnum['Mercado Livre'])

        await browser.close()
        return tableData

        // console.log(tableData);
        // console.log(tableData);

        // const invoices = await page.$$eval('tr[idnota]', (el, atr) => {
        //     // console.log(el.ma)
        //     el.map(_el => console.log(_el))
        //     // return el.map(element => element.getAttribute(atr))
        // }, 'idnota');

        await browser.close()
        // return invoices
    } catch (e) {
        throw new Error(e)
    }

}

const storeEnum = {
    'Shopee': 'shopee',
    'Shein': 'shein',
    'Mercado Livre': 'mercado',
    'Aliexpress': 'aliexpress',
}


async function sendInvoices(invoices) {
    for (const invoice of invoices) {
        // console.log(id);
        await fetch(`${process.env.API_URL}${invoice.id}&store=${storeEnum[invoice.store]}`)
            .then((res) => {
                if (res.ok) {
                    console.log(`sent invoice ${invoice.id}, status: `, res.status)
                }

                if (res.status === 401) {
                    console.log('already processed')
                }

                if (res.status === 404) {
                    throw new Error('unavailable resource')
                }
            })
            .catch((err) => {
                console.log('here');
                throw new Error('Error on invoice ' + err)
            })
    }
    console.log('finished sending invoices, waiting for routine')
}

async function scrapRoutine() {
    let attempts = 1
    for (let i = 0; i <= attempts; i++) {
        try {
            let invoices = await getInvoices();
            console.log(invoices);
            if (invoices.length > 1) {
                try {
                    await sendInvoices(invoices)
                    attempts = 0
                } catch (e) {
                    console.log('error', e)
                    throw new Error('Fail to send invoices')
                }
            }
        } catch (e) {
            console.error('Failed to start routine ', e, e.message)
        }
    }
}

async function main() {
    console.log('starting routine...')
    await scrapRoutine();
    // cron.schedule(`*/${process.env.CRON_HOUR} * * * *`, async () => {
    //     await scrapRoutine();
    // })

}

(async () => {
    await main();
})();

// cron.schedule('*/5 * * * *', () => {
//     (async () => {
//         let invoices = await getInvoices();
//         console.log(invoices);
//         if (invoices.length > 1) {
//             try {
//                 await sendInvoices(invoices)
//             } catch (e) {
//                 throw new Error(e.message)
//             }
//         }
//         // process.exit(1);
//     })().catch((e) => {
//         console.log(e)
//     });
// })