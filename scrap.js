// puppeteer-extra is a drop-in replacement for puppeteer,
// it augments the installed puppeteer with plugin functionality
const puppeteer = require('puppeteer-extra')
const cron = require('node-cron')

// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

console.log('starting nodejs script')

let noActionInvoices = 0
let cronHour = process.env.CRON_HOUR || "15"

console.log(process.env.USERNAME, process.env.CRON_HOUR, process.env.API_URL, process.env.PASSWORD);

async function getInvoices() {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.goto('https://erp.tiny.com.br/')
        await page.waitForTimeout(500)
        await page.type('input[name=username]', process.env.USERNAME);
        await page.waitForTimeout(500)
        await page.type('input[name=password]', process.env.PASSWORD);
        await page.waitForTimeout(500)
        await page.click('html > body > div > div:nth-of-type(2) > div > div > react-login > div > div > div:first-of-type > div:first-of-type > div:first-of-type > form > div:nth-of-type(3) > button');

        await page.waitForSelector('.modal-footer > button:nth-of-type(1)')
        await page.waitForTimeout(500);

        await page.click('.modal-footer > button:nth-of-type(1)');

        await page.waitForSelector('div[id=main-menu]');

        await page.goto('https://erp.tiny.com.br/notas_fiscais#list');

        await page.waitForSelector('#sit-P');
        await page.waitForTimeout(500);
        await page.$eval('#sit-P', el => el.click());
        await page.waitForTimeout(5000)


        await page.waitForTimeout(1500);

        const invoices = await page.$$eval('tr[idnota]', (el, atr) => {
            return el.map(element => element.getAttribute(atr))
        }, 'idnota');

        await browser.close()
        return invoices
    } catch (e) {
        throw new Error(e)
    }

}

async function sendInvoices(invoices) {

    for (const id of invoices) {
        console.log(id);
        if (noActionInvoices > invoices.length / 2) {
            noActionInvoces = 0
            cronHour = (Number(cronHour) + 15).toString();
            throw new Error('No actions to do on invoices, increasing cron timer +15')
        }
        await fetch(`${process.env.API_URL}${id}`)
            .then((res) => {
                if (res.ok) {
                    console.log(res.status)
                }

                if (res.status === 401) {
                    console.log('already processed')
                    noActionInvoices++
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
    noActionInvoices = 0
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
    cron.schedule(`*/${cronHour} * * * *`, async () => {
        await scrapRoutine();
    })

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