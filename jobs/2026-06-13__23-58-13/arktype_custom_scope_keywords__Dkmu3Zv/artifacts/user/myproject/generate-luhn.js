function generateLuhn(prefix, length) {
    let num = prefix;
    while (num.length < length - 1) {
        num += Math.floor(Math.random() * 10);
    }
    for (let i = 0; i < 10; i++) {
        let testNum = num + i;
        if (luhnCheck(testNum)) return testNum;
    }
}
function luhnCheck(num) {
    let sum = 0;
    let shouldDouble = false;
    for (let i = num.length - 1; i >= 0; i--) {
        let digit = parseInt(num.charAt(i), 10);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
}
console.log(generateLuhn("4", 16));
