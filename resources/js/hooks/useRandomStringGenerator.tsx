function generateRandomString(length: number): string {
    const characters: string = 'abcdefghijklmnopqrstuvwxyz';
    const hyphen: string = '-';
    let result: string = '';

    for (let i: number = 0; i < length; i++) {
        if (i === 0) {
            const randomIndex: number = Math.floor(Math.random() * characters.length);
            result += characters[randomIndex];
        } else if (i === 4 || i === 8) {
            result += hyphen; 
        } else {
            const randomIndex: number = Math.floor(Math.random() * characters.length);
            result += characters[randomIndex];
        }
    }

    return result;
}

function useRandomStringGenerator(): (length: number) => string {
    return (length: number): string => generateRandomString(length);
}

export default useRandomStringGenerator;
