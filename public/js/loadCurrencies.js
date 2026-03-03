document.addEventListener('DOMContentLoaded', async () => {
    const currencySelect = document.getElementById('steam_currency');
    
    const API_URL = 'https://api.axoshop.ru/api/steam/currencies';

    const currencySymbols = {
        'RUB': '₽',
        'USD': '$',
        'EUR': '€',
        'KZT': '₸',
        'UAH': '₴'
    };

    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (data.success && Array.isArray(data.items) && data.items.length > 0) {
            
            currencySelect.innerHTML = '';

            data.items.forEach(item => {
                const option = document.createElement('option');
                
                option.value = item.code;

                option.textContent = currencySymbols[item.code] || item.name;

                if (item.code === 'RUB') {
                    option.selected = true;
                }

                currencySelect.appendChild(option);
            });

            const event = new Event('change');
            currencySelect.dispatchEvent(event);
        }

    } catch (error) {
        console.error('Не удалось загрузить список валют:', error);
    }
});