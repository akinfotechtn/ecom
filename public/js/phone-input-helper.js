/**
 * Universal Phone Input Helper using modern intl-tel-input
 * Provides SVG country flags, country search bar, all ~240 countries worldwide,
 * and separate dial code selector.
 */
(function () {
  window.initIntlPhoneInput = function (inputEl, customOptions) {
    if (!inputEl) return null;
    if (inputEl._iti) return inputEl._iti;

    if (!window.intlTelInput) {
      console.warn('intlTelInput library not yet loaded for', inputEl);
      return null;
    }

    const defaultOptions = {
      initialCountry: 'in',
      separateDialCode: true,
      countrySearch: true,
      utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@24.5.0/build/js/utils.js'
    };

    const options = Object.assign({}, defaultOptions, customOptions || {});
    const iti = window.intlTelInput(inputEl, options);
    inputEl._iti = iti;

    // Adjust container styling
    const parentContainer = inputEl.closest('.iti');
    if (parentContainer) {
      parentContainer.style.width = '100%';
    }

    // Handle number restoration or prefill
    if (inputEl.value && inputEl.value.trim()) {
      try {
        iti.setNumber(inputEl.value.trim());
      } catch (e) {}
    }

    return iti;
  };

  window.getIntlPhoneData = function (inputEl) {
    if (!inputEl) return { fullPhone: '', dialCode: '+91', cleanPhone: '', countryIso: 'in', isValid: false };
    const iti = inputEl._iti;
    if (iti) {
      const countryData = iti.getSelectedCountryData() || {};
      const dialCode = countryData.dialCode ? ('+' + countryData.dialCode) : '+91';
      let rawNumber = '';
      try {
        rawNumber = iti.getNumber() || '';
      } catch (e) {
        rawNumber = inputEl.value.trim();
      }
      
      const cleanDigits = (rawNumber || inputEl.value).replace(/\D/g, '');
      const fullPhone = rawNumber && rawNumber.startsWith('+')
        ? rawNumber
        : (cleanDigits ? (dialCode + ' ' + cleanDigits) : '');

      let isValid = true;
      if (countryData.iso2 === 'in') {
        const localDigits = cleanDigits.slice(-10);
        isValid = localDigits.length === 10 && /^[6-9]/.test(localDigits);
      } else {
        isValid = cleanDigits.length >= 6 && cleanDigits.length <= 15;
      }

      return {
        fullPhone: fullPhone,
        dialCode: dialCode,
        cleanPhone: cleanDigits,
        countryIso: countryData.iso2 || 'in',
        countryName: countryData.name || 'India',
        isValid: isValid
      };
    } else {
      const val = inputEl.value.trim();
      const clean = val.replace(/\D/g, '');
      return {
        fullPhone: val,
        dialCode: '+91',
        cleanPhone: clean,
        countryIso: 'in',
        countryName: 'India',
        isValid: clean.length >= 10
      };
    }
  };

  window.setIntlPhoneNumber = function (inputEl, fullPhoneOrDigits) {
    if (!inputEl) return;
    if (!fullPhoneOrDigits) {
      inputEl.value = '';
      return;
    }
    const iti = inputEl._iti;
    if (iti) {
      try {
        const trimmed = String(fullPhoneOrDigits).trim();
        if (trimmed.startsWith('+')) {
          iti.setNumber(trimmed);
        } else if (trimmed.length === 10) {
          iti.setCountry('in');
          inputEl.value = trimmed;
        } else {
          iti.setNumber(trimmed);
        }
      } catch (e) {
        inputEl.value = fullPhoneOrDigits;
      }
    } else {
      inputEl.value = fullPhoneOrDigits;
    }
  };
})();
