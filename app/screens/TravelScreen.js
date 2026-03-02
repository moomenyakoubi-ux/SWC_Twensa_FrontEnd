import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from 'react-native-calendars';
import {
  Dimensions,
  FlatList,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import theme from '../styles/theme';
import { useLanguage } from '../context/LanguageContext';
import WebSidebar, { WEB_SIDE_MENU_WIDTH } from '../components/WebSidebar';
import { WEB_TAB_BAR_WIDTH } from '../components/WebTabBar';
import { searchFlights } from '../services/flightsApi';

const backgroundImage = require('../images/image1.png');
const STORAGE_KEY = 'twensai_flights_filters_v1';

const AIRPORTS_BY_COUNTRY = {
  IT: [
    { label: 'Roma (FCO)', value: 'FCO' },
    { label: 'Milano (MXP)', value: 'MXP' },
    { label: 'Napoli (NAP)', value: 'NAP' },
    { label: 'Bologna (BLQ)', value: 'BLQ' },
    { label: 'Venezia (VCE)', value: 'VCE' },
  ],
  TN: [
    { label: 'Tunisi (TUN)', value: 'TUN' },
    { label: 'Monastir (MIR)', value: 'MIR' },
    { label: 'Djerba (DJE)', value: 'DJE' },
    { label: 'Sfax (SFA)', value: 'SFA' },
  ],
};

const CARRIER_NAMES = {
  TU: 'Tunisair',
  AF: 'Air France',
  AZ: 'ITA Airways',
  A3: 'Aegean Airlines',
  FR: 'Ryanair',
  U2: 'easyJet',
  KL: 'KLM',
  LH: 'Lufthansa',
  OS: 'Austrian',
  SN: 'Brussels Airlines',
};

const ANY_OPTION = { label: 'Qualsiasi', value: null };
const resolveDestinationCountry = (originCountry) => (originCountry === 'IT' ? 'TN' : 'IT');
const isValidCountryCode = (countryCode) =>
  typeof countryCode === 'string' && Object.prototype.hasOwnProperty.call(AIRPORTS_BY_COUNTRY, countryCode);

const extractIataFromLabel = (label) => {
  if (typeof label !== 'string') return '';
  const match = label.match(/\(([A-Za-z]{3})\)/);
  return match?.[1] || '';
};

const normalizeIataCode = (value, fallbackLabel = '') => {
  if (typeof value === 'string' && value.trim()) {
    const trimmedValue = value.trim();
    if (/^[A-Za-z]{3}$/.test(trimmedValue)) {
      return trimmedValue.toUpperCase();
    }
    const embeddedCode = extractIataFromLabel(trimmedValue);
    if (embeddedCode) {
      return embeddedCode.toUpperCase();
    }
  }
  const labelCode = extractIataFromLabel(fallbackLabel);
  return labelCode ? labelCode.toUpperCase() : '';
};

const buildAirportOptions = (airports) => {
  const safeAirports = Array.isArray(airports) ? airports : [];
  return safeAirports
    .map((airport) => {
      const code = normalizeIataCode(airport?.value, airport?.label);
      if (!code) return null;
      const city = typeof airport?.label === 'string' ? airport.label.replace(/\s*\([A-Za-z]{3}\)\s*$/, '').trim() : '';
      return {
        label: city ? `${city} (${code})` : code,
        value: code,
      };
    })
    .filter(Boolean);
};

const STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  EMPTY: 'empty',
  ERROR: 'error',
};

const DropdownTab = React.forwardRef(({ label, value, isOpen, onPress, isRTL }, ref) => (
  <Pressable
    ref={ref}
    collapsable={false}
    onPress={onPress}
    style={({ pressed }) => [
      styles.dropdownTab,
      isOpen && styles.dropdownTabOpen,
      isRTL && styles.dropdownTabRtl,
      pressed && styles.pressedItem,
    ]}
  >
    <View style={[styles.dropdownTabContent, isRTL && styles.dropdownTabContentRtl]}>
      <Text style={[styles.dropdownTabText, isRTL && styles.rtlText]} numberOfLines={1}>
        {label}: {value}
      </Text>
      <Text style={styles.dropdownTabIcon}>{isOpen ? '▲' : '▼'}</Text>
    </View>
  </Pressable>
));

const TravelScreen = ({ navigation }) => {
  const { strings, isRTL } = useLanguage();
  const isWeb = Platform.OS === 'web';
  const isAndroid = Platform.OS === 'android';
  const travelStrings = strings.travel;
  const menuStrings = strings.menu;
  const sidebarTitle = strings.home?.greeting || travelStrings.title;
  const tabRefs = useRef({
    origin: React.createRef(),
    destination: React.createRef(),
    resultStops: React.createRef(),
  });
  const flatListRef = useRef(null);
  const [departureCountry, setDepartureCountry] = useState('IT');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState(null);
  const [tripType, setTripType] = useState('oneway');
  const [pickerState, setPickerState] = useState({ visible: false, type: 'departure', date: new Date() });
  const [originIata, setOriginIata] = useState(AIRPORTS_BY_COUNTRY.IT[0]?.value || '');
  const [destinationIata, setDestinationIata] = useState(null);
  const [maxStops, setMaxStops] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');
  const [status, setStatus] = useState(STATUS.IDLE);
  const [allResults, setAllResults] = useState([]);
  const [visibleResults, setVisibleResults] = useState([]);
  const [listResetKey, setListResetKey] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [formError, setFormError] = useState('');
  const [requestError, setRequestError] = useState('');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [anchor, setAnchor] = useState(null);
  const [dirtyFilters, setDirtyFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState(0);
  const [banner, setBanner] = useState({ visible: false, type: 'info', message: '' });
  const allResultsRef = useRef([]);
  const maxStopsRef = useRef(maxStops);
  const sortOrderRef = useRef(sortOrder);
  const isRestoringRef = useRef(true);

  const destinationCountry = departureCountry === 'IT' ? 'TN' : 'IT';
  const originAirportOptions = AIRPORTS_BY_COUNTRY[departureCountry] || [];
  const destinationAirportOptions = AIRPORTS_BY_COUNTRY[destinationCountry] || [];
  const originOptions = buildAirportOptions(originAirportOptions);
  const destinationOptions = [ANY_OPTION, ...buildAirportOptions(destinationAirportOptions)];
  const activeRequestIdRef = useRef(0);
  const previousNetworkFiltersRef = useRef({
    originIata,
    destinationIata,
    departureDate,
    returnDate,
    tripType,
  });
  const pendingNetworkSearchRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const restoreFilters = async () => {
      isRestoringRef.current = true;
      try {
        const savedFilters = await AsyncStorage.getItem(STORAGE_KEY);
        if (!savedFilters || !isMounted) return;

        let parsedFilters = null;
        try {
          parsedFilters = JSON.parse(savedFilters);
        } catch {
          return;
        }
        if (!parsedFilters || typeof parsedFilters !== 'object') return;

        const parsedOriginCountry = parsedFilters.originCountry || parsedFilters.departureCountry;
        const savedOriginCountry = isValidCountryCode(parsedOriginCountry)
          ? parsedOriginCountry
          : 'IT';
        const parsedDestinationCountry = isValidCountryCode(parsedFilters.destinationCountry)
          ? parsedFilters.destinationCountry
          : resolveDestinationCountry(savedOriginCountry);
        const expectedDestinationCountry = resolveDestinationCountry(savedOriginCountry);
        const restoredDestinationCountry =
          parsedDestinationCountry === expectedDestinationCountry ? parsedDestinationCountry : expectedDestinationCountry;
        const restoredOriginOptions = buildAirportOptions(AIRPORTS_BY_COUNTRY[savedOriginCountry] || []);
        const restoredDestinationOptions = buildAirportOptions(AIRPORTS_BY_COUNTRY[restoredDestinationCountry] || []);
        const restoredOriginCodes = restoredOriginOptions.map((option) => option.value);
        const restoredDestinationCodes = restoredDestinationOptions.map((option) => option.value);

        const normalizedOriginIata = normalizeIataCode(parsedFilters.originIata, '');
        const nextOriginIata = restoredOriginCodes.includes(normalizedOriginIata)
          ? normalizedOriginIata
          : restoredOriginCodes[0] || '';

        const parsedDestinationIata = parsedFilters.destinationIata;
        const normalizedDestinationIata =
          parsedDestinationIata === null ? null : normalizeIataCode(parsedDestinationIata, '');
        const nextDestinationIata =
          normalizedDestinationIata && restoredDestinationCodes.includes(normalizedDestinationIata)
            ? normalizedDestinationIata
            : null;

        const nextTripType = parsedFilters.tripType === 'roundtrip' ? 'roundtrip' : 'oneway';
        const nextReturnDate =
          nextTripType === 'oneway'
            ? null
            : typeof parsedFilters.returnDate === 'string' && parsedFilters.returnDate.trim()
              ? parsedFilters.returnDate
              : null;
        const nextDepartureDate =
          typeof parsedFilters.departureDate === 'string' && parsedFilters.departureDate.trim()
            ? parsedFilters.departureDate
            : '';
        const nextSortOrder = parsedFilters.sortOrder === 'desc' ? 'desc' : 'asc';
        const nextMaxStops =
          parsedFilters.maxStops === 0 || parsedFilters.maxStops === 1 || parsedFilters.maxStops === 2
            ? parsedFilters.maxStops
            : null;

        if (!isMounted) return;
        setDepartureCountry(savedOriginCountry);
        setOriginIata(nextOriginIata);
        setDestinationIata(nextDestinationIata);
        setDepartureDate(nextDepartureDate);
        setTripType(nextTripType);
        setReturnDate(nextReturnDate);
        setSortOrder(nextSortOrder);
        setMaxStops(nextMaxStops);
        setBanner({ visible: true, type: 'info', message: 'Filtri ripristinati' });
      } catch (error) {
        if (__DEV__) {
          console.log('[Travel] restore filters failed', error);
        }
      } finally {
        setTimeout(() => {
          if (isMounted) {
            isRestoringRef.current = false;
          }
        }, 0);
      }
    };

    void restoreFilters();

    return () => {
      isMounted = false;
      isRestoringRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isRestoringRef.current) return;

    const savePayload = {
      originCountry: departureCountry,
      destinationCountry,
      originIata,
      destinationIata,
      departureDate,
      returnDate: tripType === 'roundtrip' ? returnDate : null,
      tripType: tripType === 'roundtrip' ? 'roundtrip' : 'oneway',
      sortOrder: sortOrder === 'desc' ? 'desc' : 'asc',
      maxStops: maxStops === 0 || maxStops === 1 || maxStops === 2 ? maxStops : null,
    };

    const saveTimer = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(savePayload)).catch((error) => {
        if (__DEV__) {
          console.log('[Travel] save filters failed', error);
        }
      });
    }, 300);

    return () => clearTimeout(saveTimer);
  }, [departureCountry, destinationCountry, originIata, destinationIata, departureDate, returnDate, tripType, sortOrder, maxStops]);

  useEffect(() => {
    const originValues = originOptions.map((option) => option.value);
    const destinationValues = destinationOptions.map((option) => option.value);

    if (!originValues.includes(originIata)) {
      setOriginIata(originOptions[0]?.value || '');
    }

    if (!destinationValues.includes(destinationIata)) {
      setDestinationIata(null);
    }

    setOpenDropdown(null);
  }, [departureCountry, originAirportOptions, destinationAirportOptions, originIata, destinationIata]);

  useEffect(() => {
    if (isRestoringRef.current || !hasSearched || isFetching) return;
    setFormError('');
    setRequestError('');
    setDirtyFilters(true);
  }, [departureCountry, departureDate, returnDate, tripType, hasSearched, isFetching]);

  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const parseDateString = (value) => {
    const [day, month, year] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const toIsoDate = (value) => {
    if (!value) return '';
    const [day, month, year] = value.split('-');
    if (!day || !month || !year) return '';
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const formatTime = (iso) => {
    if (!iso || typeof iso !== 'string') return '--';
    const directMatch = iso.match(/T(\d{2}):(\d{2})/);
    if (directMatch) {
      return `${directMatch[1]}:${directMatch[2]}`;
    }
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return '--';
    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatDuration = (minutes) => {
    const totalMinutes = Math.floor(Number(minutes));
    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return '--';
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  const formatStops = (value) => {
    const stops = Math.floor(Number(value));
    if (!Number.isFinite(stops) || stops < 0) return '--';
    if (stops === 0) return 'Diretto';
    if (stops === 1) return '1 scalo';
    if (stops === 2) return '2 scali';
    return '3+ scali';
  };

  const formatPrice = (priceObj) => {
    if (!priceObj || typeof priceObj !== 'object') return '--';
    const total = Number(priceObj.total);
    const currency = typeof priceObj.currency === 'string' ? priceObj.currency.toUpperCase() : '';
    if (!Number.isFinite(total) || !currency) return '--';
    if (currency === 'EUR') {
      return `${total.toFixed(2).replace('.', ',')} €`;
    }
    return `${total.toFixed(2)} ${currency}`;
  };

  const normalizeCarrierCode = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim().toUpperCase();
  };

  const getUniqueCarriersFromSegments = (segments) => {
    if (!Array.isArray(segments) || !segments.length) return [];
    const carrierCodes = new Set();
    segments.forEach((segment) => {
      const code = normalizeCarrierCode(segment?.carrier);
      if (code) {
        carrierCodes.add(code);
      }
    });
    return Array.from(carrierCodes);
  };

  const getUniqueCarrierCodes = (codes) => {
    if (!Array.isArray(codes) || !codes.length) return [];
    const uniqueCodes = new Set();
    codes.forEach((codeValue) => {
      const code = normalizeCarrierCode(codeValue);
      if (code) {
        uniqueCodes.add(code);
      }
    });
    return Array.from(uniqueCodes);
  };

  const formatCarriers = (codes) => {
    const uniqueCodes = getUniqueCarrierCodes(codes);
    if (!uniqueCodes.length) return '--';

    const visibleCodes = uniqueCodes.slice(0, 3);
    const visibleCarriers = visibleCodes.map((code) => {
      const carrierName = CARRIER_NAMES[code];
      return carrierName ? `${carrierName} (${code})` : code;
    });

    const suffix = uniqueCodes.length > 3 ? ', …' : '';
    return `${visibleCarriers.join(', ')}${suffix}`;
  };

  const formatCarrierLine = (codes) => {
    const uniqueCodes = getUniqueCarrierCodes(codes);
    if (!uniqueCodes.length) return 'Compagnia: --';
    const prefix = uniqueCodes.length === 1 ? 'Compagnia' : 'Compagnie';
    return `${prefix}: ${formatCarriers(uniqueCodes)}`;
  };

  const updateDate = (type, date) => {
    const formatted = formatDate(date);
    if (type === 'departure') {
      setDepartureDate(formatted);
    } else {
      setReturnDate(formatted);
    }
  };

  const openDatePicker = (type) => {
    const existingValue =
      type === 'departure'
        ? departureDate
        : type === 'return'
          ? returnDate
          : '';
    const initialDate = existingValue ? parseDateString(existingValue) : new Date();
    setPickerState({ visible: true, type, date: initialDate });
  };

  const handleDateSelection = (selectedValue) => {
    if (!selectedValue) return;
    const [year, month, day] = selectedValue.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day);
    updateDate(pickerState.type, selectedDate);
    setPickerState((prev) => ({ ...prev, date: selectedDate, visible: false }));
  };

  const renderPickerOverlay = () => {
    if (!pickerState.visible) return null;

    const pickerDateValue = pickerState.date.toISOString().split('T')[0];
    const pickerContent = (
      <View style={styles.pickerCard}>
        <Calendar
          current={pickerDateValue}
          onDayPress={(day) => handleDateSelection(day.dateString)}
          markedDates={{
            [pickerDateValue]: {
              selected: true,
              selectedColor: theme.colors.primary,
              selectedTextColor: '#000000',
            },
          }}
          theme={{
            calendarBackground: theme.colors.card,
            textSectionTitleColor: '#000000',
            dayTextColor: '#000000',
            todayTextColor: theme.colors.primary,
            monthTextColor: '#000000',
            textDisabledColor: '#666666',
            arrowColor: theme.colors.primary,
          }}
        />
        <Pressable style={styles.pickerClose} onPress={() => setPickerState((prev) => ({ ...prev, visible: false }))}>
          <Text style={styles.pickerCloseLabel}>OK</Text>
        </Pressable>
      </View>
    );

    if (Platform.OS === 'web') {
      return <View style={styles.webPickerOverlay}>{pickerContent}</View>;
    }

    return (
      <Modal
        transparent
        animationType="fade"
        visible
        onRequestClose={() => setPickerState((prev) => ({ ...prev, visible: false }))}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerState((prev) => ({ ...prev, visible: false }))}>
          <Pressable style={styles.modalInner}>{pickerContent}</Pressable>
        </Pressable>
      </Modal>
    );
  };

  const getOptionLabel = (options, value, fallback = '') => {
    const match = options.find((option) => option.value === value);
    return match?.label || fallback;
  };

  const toggleDropdown = (key) => {
    if (openDropdown === key) {
      setOpenDropdown(null);
      setAnchor(null);
      return;
    }

    const ref = tabRefs.current?.[key]?.current;
    if (ref?.measureInWindow) {
      ref.measureInWindow((x, y, width, height) => {
        setAnchor({ x, y, w: width, h: height });
        setOpenDropdown(key);
      });
    } else {
      setAnchor(null);
      setOpenDropdown(key);
    }
  };

  const closeDropdown = () => {
    setOpenDropdown(null);
    setAnchor(null);
  };

  const applyTransforms = (offers, nextMaxStops, nextSortOrder) => {
    let arr = Array.isArray(offers) ? [...offers] : [];

    if (nextMaxStops !== null && nextMaxStops !== undefined) {
      const maxStopsValue = Number(nextMaxStops);
      if (Number.isFinite(maxStopsValue)) {
        arr = arr.filter((offer) => {
          const outboundStops = Number(offer?.outbound?.stops);
          if (!Number.isFinite(outboundStops) || outboundStops > maxStopsValue) {
            return false;
          }
          if (!offer?.inbound) {
            return true;
          }
          const inboundStops = Number(offer?.inbound?.stops);
          return Number.isFinite(inboundStops) && inboundStops <= maxStopsValue;
        });
      }
    }

    const normalizedOrder = nextSortOrder === 'desc' ? 'desc' : 'asc';
    const invalidFallback =
      normalizedOrder === 'desc' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

    arr.sort((a, b) => {
      const rawPriceA = Number(a?.price?.total);
      const rawPriceB = Number(b?.price?.total);
      const priceA = Number.isFinite(rawPriceA) ? rawPriceA : invalidFallback;
      const priceB = Number.isFinite(rawPriceB) ? rawPriceB : invalidFallback;
      if (priceA === priceB) return 0;
      return normalizedOrder === 'desc' ? priceB - priceA : priceA - priceB;
    });

    return arr;
  };

  const buildRequestPayload = () => {
    const normalizedOriginIata = normalizeIataCode(originIata, getOptionLabel(originOptions, originIata, ''));
    const fallbackOriginIata = originOptions[0]?.value || '';
    const finalOriginIata = normalizedOriginIata || fallbackOriginIata;
    const normalizedDestinationIata = destinationIata === null ? null : normalizeIataCode(destinationIata, '');

    return {
      originCountry: departureCountry,
      originIata: finalOriginIata,
      destinationCountry,
      destinationIata: normalizedDestinationIata,
      departureDate: toIsoDate(departureDate),
      returnDate: tripType === 'roundtrip' && returnDate ? toIsoDate(returnDate) : null,
      tripType,
      adults: 1,
      currency: 'EUR',
    };
  };

  const showBanner = (type, message) => {
    setBanner({
      visible: true,
      type,
      message,
    });
  };

  const formatSummaryDate = (value) => {
    if (!value) return '--';
    const [day, month] = String(value).split('-');
    if (!day || !month) return '--';
    return `${day}/${month}`;
  };

  const buildFilterSummary = () => {
    const originLabel = getOptionLabel(originOptions, originIata, originOptions[0]?.label || '--');
    const destinationLabel = getOptionLabel(destinationOptions, destinationIata, destinationIata || ANY_OPTION.label);
    const stopsLabel =
      maxStops === null ? 'Qualsiasi' : maxStops === 0 ? 'Diretto' : maxStops === 1 ? '≤1' : maxStops === 2 ? '≤2' : 'Qualsiasi';
    const priceDirection = sortOrder === 'desc' ? '↓' : '↑';
    const departureSummary = formatSummaryDate(departureDate);
    const returnSummary = tripType === 'roundtrip' ? formatSummaryDate(returnDate) : '--';
    return `${originLabel} → ${destinationLabel} • Scali: ${stopsLabel} • Prezzo: ${priceDirection} • Date: ${departureSummary} – ${returnSummary}`;
  };

  const runSearch = async (trigger = 'manual') => {
    if (isFetching) return;

    const requestPayload = buildRequestPayload();
    const reqId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = reqId;
    setActiveRequestId(reqId);
    setDirtyFilters(false);
    setOpenDropdown(null);
    setAnchor(null);
    setIsFetching(true);
    pendingNetworkSearchRef.current = false;
    setAllResults([]);
    setStatus(STATUS.LOADING);
    setListResetKey((k) => k + 1);
    showBanner('loading', 'Aggiornamento risultati...');

    setFormError('');
    setRequestError('');

    if (!requestPayload.originIata) {
      setFormError('Seleziona aeroporto di partenza');
      showBanner('error', 'Seleziona aeroporto di partenza');
      if (reqId === activeRequestIdRef.current) {
        setIsFetching(false);
      }
      return;
    }

    if (!departureDate) {
      setFormError(travelStrings.departureDateRequired);
      if (reqId === activeRequestIdRef.current) {
        setIsFetching(false);
      }
      return;
    }

    if (tripType === 'roundtrip' && !returnDate) {
      const missingReturnMessage = 'Seleziona la data di ritorno';
      setFormError(missingReturnMessage);
      showBanner('error', missingReturnMessage);
      if (reqId === activeRequestIdRef.current) {
        setIsFetching(false);
      }
      return;
    }

    if (tripType === 'roundtrip' && returnDate) {
      const departureValue = parseDateString(departureDate);
      const returnValue = parseDateString(returnDate);
      if (returnValue < departureValue) {
        setFormError(travelStrings.returnBeforeDeparture);
        showBanner('error', travelStrings.returnBeforeDeparture);
        if (reqId === activeRequestIdRef.current) {
          setIsFetching(false);
        }
        return;
      }
    }

    try {
      if (__DEV__) {
        console.log('Flight search trigger', trigger, requestPayload);
      }
      const data = await searchFlights(requestPayload);
      if (reqId !== activeRequestIdRef.current) {
        return;
      }
      const offers = Array.isArray(data) ? data : [];
      setAllResults(offers);
      setHasSearched(true);
      setStatus(offers.length ? STATUS.SUCCESS : STATUS.EMPTY);

      if (!offers.length) {
        showBanner('info', travelStrings.emptyState);
      } else {
        showBanner('success', 'Risultati aggiornati');
      }
    } catch (error) {
      if (reqId !== activeRequestIdRef.current) {
        return;
      }
      setRequestError(error?.message || travelStrings.errorState);
      setStatus(STATUS.ERROR);
      showBanner('error', 'Errore durante la ricerca.');
    } finally {
      if (reqId === activeRequestIdRef.current) {
        setIsFetching(false);
      }
    }
  };

  const handleStopsChange = (nextStops) => {
    if (__DEV__) {
      console.log('[UI] maxStops ->', nextStops);
      console.log('[UI] apply filters now', {
        maxStops: nextStops,
        sortOrder: sortOrderRef.current,
        all: allResultsRef.current.length,
      });
    }
    setMaxStops(nextStops);
    const transformed = applyTransforms(allResultsRef.current, nextStops, sortOrderRef.current);
    setVisibleResults(transformed);
    closeDropdown();
    setDirtyFilters(false);
    setFormError('');
    setRequestError('');
    showBanner('info', 'Filtro scali applicato');
  };

  const handleSortOrderChange = () => {
    const nextOrder = sortOrderRef.current === 'asc' ? 'desc' : 'asc';
    setSortOrder(nextOrder);
    const transformed = applyTransforms(allResultsRef.current, maxStopsRef.current, nextOrder);
    setVisibleResults(transformed);
    closeDropdown();
    if (__DEV__) {
      console.log('[UI] sortOrder changed', nextOrder);
      console.log('[UI] apply sort now', {
        maxStops: maxStopsRef.current,
        sortOrder: nextOrder,
        all: allResultsRef.current.length,
      });
    }
    setDirtyFilters(false);
    setFormError('');
    setRequestError('');
    showBanner('info', 'Ordinamento applicato');
  };

  const handleOriginChange = (nextOriginIata) => {
    const normalizedOriginIata = normalizeIataCode(nextOriginIata, '');
    if (!normalizedOriginIata) return;
    if (normalizedOriginIata === originIata) return;
    setOriginIata(normalizedOriginIata);
    setFormError('');
    setRequestError('');
    const selectedOrigin = getOptionLabel(originOptions, normalizedOriginIata, originOptions[0]?.label || '--');
    showBanner('info', `Partenza aggiornata: ${selectedOrigin}`);
  };

  const handleDestinationChange = (nextDestinationIata) => {
    const normalizedDestinationIata = nextDestinationIata === null ? null : normalizeIataCode(nextDestinationIata, '');
    if (normalizedDestinationIata === destinationIata) return;
    setDestinationIata(normalizedDestinationIata);
    setFormError('');
    setRequestError('');
    const selectedDestination = getOptionLabel(
      destinationOptions,
      normalizedDestinationIata,
      normalizedDestinationIata || '--',
    );
    showBanner('info', `Arrivo aggiornato: ${selectedDestination}`);
  };

  const handleTripTypeChange = (nextTripType) => {
    if (nextTripType === tripType) return;
    setTripType(nextTripType);
    setFormError('');
    setRequestError('');

    if (nextTripType === 'oneway') {
      if (returnDate !== null) {
        setReturnDate(null);
      }
      showBanner('info', 'Modalita: solo andata');
      return;
    }

    showBanner('info', 'Modalita: andata e ritorno');
  };

  useEffect(() => {
    allResultsRef.current = allResults;
    maxStopsRef.current = maxStops;
    sortOrderRef.current = sortOrder;
    const transformed = applyTransforms(allResults, maxStops, sortOrder);
    if (__DEV__) {
      console.log('[UI] recompute visible', { all: allResults.length, maxStops, sortOrder, vis: transformed.length });
    }
    setVisibleResults(transformed);
  }, [allResults, maxStops, sortOrder]);

  useEffect(() => {
    if (isRestoringRef.current) return;

    const previous = previousNetworkFiltersRef.current;
    const networkChanged =
      previous.originIata !== originIata ||
      previous.destinationIata !== destinationIata ||
      previous.departureDate !== departureDate ||
      previous.returnDate !== returnDate ||
      previous.tripType !== tripType;

    previousNetworkFiltersRef.current = {
      originIata,
      destinationIata,
      departureDate,
      returnDate,
      tripType,
    };

    if (!networkChanged || !hasSearched) return;

    if (isFetching) {
      pendingNetworkSearchRef.current = true;
      return;
    }

    const onlyReturnChanged =
      previous.originIata === originIata &&
      previous.destinationIata === destinationIata &&
      previous.departureDate === departureDate &&
      previous.tripType === tripType &&
      previous.returnDate !== returnDate;

    if (tripType !== 'roundtrip' && onlyReturnChanged) {
      return;
    }

    void runSearch('networkChange');
  }, [originIata, destinationIata, departureDate, returnDate, tripType, hasSearched, isFetching]);

  useEffect(() => {
    if (isFetching || !hasSearched || !pendingNetworkSearchRef.current) return;
    pendingNetworkSearchRef.current = false;
    void runSearch('networkChange');
  }, [isFetching, hasSearched]);

  useEffect(() => {
    if (!__DEV__) return;
    console.log(
      'originIata',
      originIata,
      'destinationIata',
      destinationIata,
      'isFetching',
      isFetching,
      'allResults',
      allResults.length,
    );
  }, [originIata, destinationIata, isFetching, allResults.length, activeRequestId]);

  const countryOptions = [
    { value: 'TN', label: travelStrings.tunisia },
    { value: 'IT', label: travelStrings.italy },
  ];

  const tripTypeOptions = [
    { key: 'oneway', value: 'oneway', label: 'Solo andata' },
    { key: 'roundtrip', value: 'roundtrip', label: 'Andata e ritorno' },
  ];

  const stopsOptions = [
    { key: 'any', value: null, label: 'Qualsiasi' },
    { key: '0', value: 0, label: 'Diretto' },
    { key: '1', value: 1, label: '1 scalo' },
    { key: '2', value: 2, label: '2 scali' },
  ];

  const originValueLabel = getOptionLabel(originOptions, originIata, originOptions[0]?.label || '--');
  const destinationValueLabel = getOptionLabel(destinationOptions, destinationIata, ANY_OPTION.label);
  const stopsValueLabel = getOptionLabel(stopsOptions, maxStops ?? null, 'Qualsiasi');
  const priceValueLabel = sortOrder === 'asc' ? '↑' : '↓';

  const searchDropdownTabs = [
    {
      key: 'origin',
      label: travelStrings.originTabLabel,
      value: originValueLabel,
      options: originOptions,
      selectedValue: originIata,
      onSelect: handleOriginChange,
    },
    {
      key: 'destination',
      label: travelStrings.destinationTabLabel,
      value: destinationValueLabel,
      options: destinationOptions,
      selectedValue: destinationIata,
      onSelect: handleDestinationChange,
    },
  ];

  const resultStopsDropdownTab = {
    key: 'resultStops',
    label: travelStrings.stopsTabLabel,
    value: stopsValueLabel,
    options: stopsOptions,
    selectedValue: maxStops ?? null,
    onSelect: handleStopsChange,
  };

  const allDropdownTabs = [...searchDropdownTabs, resultStopsDropdownTab];
  const activeDropdown = allDropdownTabs.find((tab) => tab.key === openDropdown) || null;
  const showResultFilters = hasSearched && !isFetching && allResults.length > 0;
  const windowDimensions = Dimensions.get('window');
  const dropdownRowHeight = 44;
  const dropdownPadding = theme.spacing.xs * 2;

  const getDropdownPanelStyle = () => {
    if (!anchor || !activeDropdown) return {};
    const maxWidth = Math.min(anchor.w * 1.4, 320);
    const menuHeight = activeDropdown.options.length * dropdownRowHeight + dropdownPadding;
    let top = anchor.y + anchor.h + 8;
    if (top + menuHeight > windowDimensions.height) {
      top = anchor.y - menuHeight - 8;
    }
    top = Math.max(8, top);
    let left = anchor.x;
    if (left + maxWidth > windowDimensions.width - theme.spacing.lg) {
      left = Math.max(theme.spacing.lg, windowDimensions.width - maxWidth - theme.spacing.lg);
    }
    return {
      top,
      left,
      minWidth: anchor.w,
      maxWidth,
    };
  };

  const renderSegmentedControl = (options, selectedValue, onSelect) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.segmentRow, isRTL && styles.segmentRowRtl]}
    >
      {options.map((option) => {
        const isSelected = selectedValue === option.value;
        return (
          <Pressable
            key={option.key || option.value || option.label}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [
              styles.segment,
              isSelected && styles.segmentSelected,
              isRTL && styles.segmentRtl,
              pressed && styles.pressedItem,
            ]}
          >
            <Text style={[styles.segmentLabel, isSelected && styles.segmentLabelSelected, isRTL && styles.rtlText]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const renderTrip = ({ item }) => {
    const formatStopsAirportsLine = (segments, stopsValue, singularLabel, pluralLabel) => {
      const stopsNumber = Math.floor(Number(stopsValue));
      if (!Number.isFinite(stopsNumber) || stopsNumber <= 0) {
        return 'Diretto';
      }

      const safeSegments = Array.isArray(segments) ? segments : [];
      const stopsAirports = safeSegments
        .slice(0, -1)
        .map((segment) => normalizeIataCode(segment?.to || segment?.toIata, ''))
        .filter(Boolean);

      if (!stopsAirports.length) {
        return stopsNumber === 1 ? `${singularLabel}: --` : `${pluralLabel}: --`;
      }

      const visibleStops = stopsAirports.slice(0, 3);
      const suffix = stopsAirports.length > 3 ? ', ...' : '';
      const label = stopsAirports.length === 1 ? singularLabel : pluralLabel;
      return `${label}: ${visibleStops.join(', ')}${suffix}`;
    };

    const outboundSegments = Array.isArray(item?.outbound?.segments) ? item.outbound.segments : [];
    const firstOutboundSegment = outboundSegments[0];
    const lastOutboundSegment = outboundSegments[outboundSegments.length - 1];
    const routeOrigin = firstOutboundSegment?.from || firstOutboundSegment?.fromIata || originIata || '--';
    const routeDestination = lastOutboundSegment?.to || lastOutboundSegment?.toIata || destinationIata || '--';

    const outboundTimes = `${formatTime(item?.outbound?.departure)} – ${formatTime(item?.outbound?.arrival)}`;
    const outboundCarrierCodes = getUniqueCarriersFromSegments(outboundSegments);
    const outboundMetaCarrierCodes = Array.isArray(item?.meta?.carriers) ? item.meta.carriers : [];
    const outboundCarrierLine = formatCarrierLine(
      outboundCarrierCodes.length ? outboundCarrierCodes : outboundMetaCarrierCodes,
    );
    const outboundInfo = `${formatStops(item?.outbound?.stops)} • Durata: ${formatDuration(item?.outbound?.durationMinutes)}`;
    const outboundStopsLine = formatStopsAirportsLine(outboundSegments, item?.outbound?.stops, 'Scalo', 'Scali');
    const formattedPrice = formatPrice(item?.price);

    const hasInbound = Boolean(item?.inbound);
    const inboundSegments = Array.isArray(item?.inbound?.segments) ? item.inbound.segments : [];
    const inboundCarrierLine = formatCarrierLine(getUniqueCarriersFromSegments(inboundSegments));
    const inboundTimes = `${formatTime(item?.inbound?.departure)} – ${formatTime(item?.inbound?.arrival)}`;
    const inboundInfo = `${formatStops(item?.inbound?.stops)} • Durata: ${formatDuration(item?.inbound?.durationMinutes)}`;
    const inboundStopsLine = formatStopsAirportsLine(
      inboundSegments,
      item?.inbound?.stops,
      'Scalo ritorno',
      'Scali ritorno',
    );

    return (
      <View style={styles.flightCard}>
        <Text style={[styles.flightRouteTitle, isRTL && styles.rtlText]}>{`${routeOrigin} → ${routeDestination}`}</Text>
        <Text style={[styles.flightTimes, isRTL && styles.rtlText]}>{outboundTimes}</Text>
        <Text style={[styles.flightInfo, isRTL && styles.rtlText]}>{outboundCarrierLine}</Text>
        <Text style={[styles.flightInfo, isRTL && styles.rtlText]}>{outboundInfo}</Text>
        <Text style={[styles.flightInfo, isRTL && styles.rtlText]}>{outboundStopsLine}</Text>
        <Text style={[styles.flightPrice, isRTL && styles.rtlText]}>{formattedPrice}</Text>
        {hasInbound ? (
          <View style={styles.returnBlock}>
            <Text style={[styles.returnTitle, isRTL && styles.rtlText]}>{`Ritorno: ${inboundTimes}`}</Text>
            <Text style={[styles.returnInfo, isRTL && styles.rtlText]}>{inboundCarrierLine}</Text>
            <Text style={[styles.returnInfo, isRTL && styles.rtlText]}>{inboundInfo}</Text>
            <Text style={[styles.returnInfo, isRTL && styles.rtlText]}>{inboundStopsLine}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderStatusState = () => {
    const shouldShowEmptyState = hasSearched && !isFetching && visibleResults.length === 0;
    const emptySubtitle =
      destinationIata === null
        ? 'Prova a selezionare un aeroporto specifico di arrivo.'
        : 'Prova a cambiare date o destinazione.';

    const handleEditFiltersPress = () => {
      flatListRef.current?.scrollToOffset?.({ offset: 0, animated: true });
      closeDropdown();
    };

    const renderSkeletonList = () => (
      <View style={styles.skeletonList}>
        {[0, 1, 2].map((index) => (
          <View key={`skeleton-${index}`} style={styles.skeletonCard}>
            <View style={[styles.skeletonLine, styles.skeletonTitleLine]} />
            <View style={[styles.skeletonLine, styles.skeletonTimesLine]} />
            <View style={[styles.skeletonLine, styles.skeletonInfoLine]} />
            <View style={styles.skeletonPriceRow}>
              <View style={[styles.skeletonLine, styles.skeletonPriceLine]} />
            </View>
          </View>
        ))}
      </View>
    );

    if (isFetching) {
      return renderSkeletonList();
    }

    if (status === STATUS.ERROR) {
      return (
        <View style={styles.statusContainer}>
          <Text style={[styles.statusText, isRTL && styles.rtlText]}>{requestError || travelStrings.errorState}</Text>
          <Pressable style={styles.retryButton} onPress={() => void runSearch('manual')}>
            <Text style={styles.retryLabel}>{travelStrings.retryLabel}</Text>
          </Pressable>
        </View>
      );
    }

    if (shouldShowEmptyState) {
      return (
        <View style={styles.emptyStateCard}>
          <Text style={[styles.emptyStateTitle, isRTL && styles.rtlText]}>Nessun volo trovato</Text>
          <Text style={[styles.emptyStateSubtitle, isRTL && styles.rtlText]}>{emptySubtitle}</Text>
          <Pressable style={styles.emptyStateButton} onPress={handleEditFiltersPress}>
            <Text style={styles.emptyStateButtonLabel}>Modifica filtri</Text>
          </Pressable>
        </View>
      );
    }

    return <Text style={[styles.emptyState, isRTL && styles.rtlText]}>{travelStrings.idleState}</Text>;
  };

  const isSearching = isFetching;
  const hasResults = !isSearching && visibleResults.length > 0;
  const bannerTypeStyle =
    banner.type === 'loading'
      ? styles.bannerLoading
      : banner.type === 'success'
        ? styles.bannerSuccess
        : banner.type === 'error'
          ? styles.bannerError
          : styles.bannerInfo;
  const filterSummary = buildFilterSummary();

  return (
    <ImageBackground
      source={backgroundImage}
      defaultSource={backgroundImage}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.overlay, isWeb && styles.overlayWeb]}>
          <FlatList
            ref={flatListRef}
            key={`flights-${listResetKey}`}
            data={isFetching ? [] : visibleResults}
            extraData={{ isFetching, sortOrder, maxStops, listResetKey, visibleLen: visibleResults.length }}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderTrip}
            contentContainerStyle={[styles.list, isWeb && styles.webList]}
            ListHeaderComponent={
              <View style={[styles.filtersContainer, isWeb && styles.filtersWeb]}>

                <Text style={[styles.label, isRTL && styles.rtlText]}>{travelStrings.departureCountryLabel}</Text>
                {renderSegmentedControl(countryOptions, departureCountry, setDepartureCountry)}

                <View style={[styles.dropdownTabsWrapper, isRTL && styles.dropdownTabsWrapperRtl]}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.dropdownTabsRow, isRTL && styles.dropdownTabsRowRtl]}
                  >
                    {searchDropdownTabs.map((tab) => (
                      <DropdownTab
                        key={tab.key}
                        label={tab.label}
                        value={tab.value}
                        isOpen={openDropdown === tab.key}
                        onPress={() => toggleDropdown(tab.key)}
                        isRTL={isRTL}
                        ref={tabRefs.current[tab.key]}
                      />
                    ))}
                  </ScrollView>
                </View>

                <Text style={[styles.label, isRTL && styles.rtlText]}>Tipo viaggio</Text>
                {renderSegmentedControl(tripTypeOptions, tripType, handleTripTypeChange)}

                <Text style={[styles.label, isRTL && styles.rtlText]}>{travelStrings.departureDateLabel}</Text>
                <TextInput
                  style={[styles.input, isRTL && styles.inputRtl]}
                  placeholder={travelStrings.datePlaceholder}
                  placeholderTextColor={theme.colors.muted}
                  value={departureDate}
                  onFocus={() => openDatePicker('departure')}
                  onPressIn={() => openDatePicker('departure')}
                  showSoftInputOnFocus={false}
                  caretHidden
                  editable={isAndroid}
                />

                {tripType === 'roundtrip' ? (
                  <>
                    <Text style={[styles.label, isRTL && styles.rtlText]}>{travelStrings.returnDateLabel}</Text>
                    <TextInput
                      style={[styles.input, isRTL && styles.inputRtl]}
                      placeholder={travelStrings.datePlaceholder}
                      placeholderTextColor={theme.colors.muted}
                      value={returnDate || ''}
                      onFocus={() => openDatePicker('return')}
                      onPressIn={() => openDatePicker('return')}
                      showSoftInputOnFocus={false}
                      caretHidden
                      editable={isAndroid}
                    />
                  </>
                ) : null}

                {renderPickerOverlay()}

                <Text style={[styles.helper, isRTL && styles.rtlText]}>{travelStrings.filterHint}</Text>

                {dirtyFilters ? (
                  <Text style={[styles.dirtyHint, isRTL && styles.rtlText]}>{travelStrings.filtersDirtyHint}</Text>
                ) : null}

                {formError ? <Text style={[styles.formError, isRTL && styles.rtlText]}>{formError}</Text> : null}

                <Pressable
                  style={[styles.searchButton, isSearching && styles.searchButtonDisabled]}
                  onPress={() => void runSearch('manual')}
                  disabled={isSearching}
                >
                  <Text style={styles.searchLabel}>{travelStrings.searchButton}</Text>
                </Pressable>

                {banner.visible ? (
                  <View style={[styles.bannerCard, bannerTypeStyle]}>
                    <View style={[styles.bannerHeader, isRTL && styles.bannerHeaderRtl]}>
                      <Text style={[styles.bannerMessage, isRTL && styles.rtlText]}>{banner.message}</Text>
                      <Pressable
                        onPress={() => setBanner((prev) => ({ ...prev, visible: false }))}
                        style={({ pressed }) => [styles.bannerCloseButton, pressed && styles.pressedItem]}
                      >
                        <Text style={styles.bannerCloseLabel}>X</Text>
                      </Pressable>
                    </View>
                    <Text style={[styles.bannerSummary, isRTL && styles.rtlText]}>{filterSummary}</Text>
                    {banner.type === 'error' ? (
                      <Pressable
                        style={({ pressed }) => [styles.bannerRetryButton, pressed && styles.pressedItem]}
                        onPress={() => void runSearch('manual')}
                      >
                        <Text style={styles.bannerRetryLabel}>{travelStrings.retryLabel || 'Riprova'}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                <View style={[styles.resultsHeaderRow, isRTL && styles.resultsHeaderRowRtl]}>
                  <Text style={[styles.resultsTitle, isRTL && styles.rtlText]}>{travelStrings.resultsTitle}</Text>
                  {showResultFilters ? (
                    <View style={[styles.resultsFiltersRow, isRTL && styles.resultsFiltersRowRtl]}>
                      <DropdownTab
                        key={resultStopsDropdownTab.key}
                        label={resultStopsDropdownTab.label}
                        value={resultStopsDropdownTab.value}
                        isOpen={openDropdown === resultStopsDropdownTab.key}
                        onPress={() => toggleDropdown(resultStopsDropdownTab.key)}
                        isRTL={isRTL}
                        ref={tabRefs.current[resultStopsDropdownTab.key]}
                      />
                      <Pressable
                        style={({ pressed }) => [styles.resultPriceTab, pressed && styles.pressedItem]}
                        onPress={handleSortOrderChange}
                      >
                        <Text style={[styles.resultPriceTabText, isRTL && styles.rtlText]}>
                          {`${travelStrings.priceTabLabel}: ${priceValueLabel}`}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            }
            ListEmptyComponent={!hasResults ? renderStatusState : null}
            showsVerticalScrollIndicator={false}
          />
          {openDropdown && activeDropdown ? (
            <Modal transparent animationType="fade" visible onRequestClose={closeDropdown}>
              <Pressable style={styles.modalBackdrop} onPress={closeDropdown} />
              <View style={[styles.dropdownPanel, getDropdownPanelStyle()]}>
                {activeDropdown.options.map((option) => {
                  const isSelected = activeDropdown.selectedValue === option.value;
                  return (
                    <Pressable
                      key={option.key || option.value || option.label}
                      style={({ pressed }) => [
                        styles.dropdownOption,
                        isSelected && styles.dropdownOptionSelected,
                        pressed && styles.pressedItem,
                      ]}
                      onPress={() => {
                        activeDropdown.onSelect(option.value);
                        closeDropdown();
                      }}
                    >
                      <Text
                        style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected, isRTL && styles.rtlText]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Modal>
          ) : null}
          <WebSidebar
            title={sidebarTitle}
            menuStrings={menuStrings}
            navigation={navigation}
            isRTL={isRTL}
          />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    position: 'relative',
  },
  overlayWeb: {
    paddingLeft: WEB_TAB_BAR_WIDTH,
  },
  backgroundImage: {
    resizeMode: 'cover',
    alignSelf: 'center',
    width: '100%',
    height: '100%',
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  webList: {
    paddingRight: theme.spacing.lg + WEB_SIDE_MENU_WIDTH,
    paddingLeft: theme.spacing.lg + WEB_TAB_BAR_WIDTH,
  },
  filtersContainer: {
    gap: theme.spacing.sm,
  },
  filtersWeb: {
    paddingHorizontal: theme.spacing.xl,
    maxWidth: 980,
    width: '100%',
    alignSelf: 'center',
  },
  label: {
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  segmentRowRtl: {
    flexDirection: 'row-reverse',
  },
  segment: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.muted,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
    marginRight: theme.spacing.sm,
  },
  segmentRtl: {
    marginRight: 0,
    marginLeft: theme.spacing.sm,
  },
  segmentSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  segmentLabel: {
    color: theme.colors.text,
  },
  segmentLabelSelected: {
    color: theme.colors.card,
    fontWeight: '700',
  },
  dropdownTabsWrapper: {
    marginTop: theme.spacing.sm,
  },
  dropdownTabsWrapperRtl: {
    alignItems: 'flex-end',
  },
  dropdownTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  dropdownTabsRowRtl: {
    flexDirection: 'row-reverse',
  },
  dropdownTab: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
    ...theme.shadow.card,
  },
  dropdownTabRtl: {
    marginRight: 0,
    marginLeft: theme.spacing.sm,
  },
  dropdownTabOpen: {
    borderColor: theme.colors.primary,
  },
  dropdownTabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  dropdownTabContentRtl: {
    flexDirection: 'row-reverse',
  },
  dropdownTabText: {
    color: theme.colors.text,
    fontWeight: '600',
    maxWidth: 180,
  },
  dropdownTabIcon: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
  },
  inputRtl: {
    textAlign: 'right',
  },
  helper: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  dirtyHint: {
    fontSize: 13,
    color: theme.colors.secondary,
  },
  formError: {
    fontSize: 13,
    color: theme.colors.primary,
  },
  searchButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: theme.spacing.xs,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchLabel: {
    color: theme.colors.card,
    fontWeight: '700',
    fontSize: 16,
  },
  bannerCard: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  bannerInfo: {
    backgroundColor: '#F4F7FF',
  },
  bannerLoading: {
    backgroundColor: '#FFF8EB',
  },
  bannerSuccess: {
    backgroundColor: '#ECFDF3',
  },
  bannerError: {
    backgroundColor: '#FDECEC',
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  bannerHeaderRtl: {
    flexDirection: 'row-reverse',
  },
  bannerMessage: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  bannerSummary: {
    marginTop: 4,
    fontSize: 12,
    color: theme.colors.muted,
    lineHeight: 18,
  },
  bannerCloseButton: {
    minWidth: 24,
    minHeight: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,27,51,0.08)',
  },
  bannerCloseLabel: {
    fontWeight: '600',
    color: theme.colors.text,
    fontSize: 12,
  },
  bannerRetryButton: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  bannerRetryLabel: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  modalInner: {
    width: '100%',
    maxWidth: 420,
  },
  pickerCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  pickerClose: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  pickerCloseLabel: {
    fontWeight: '700',
    color: theme.colors.primary,
    fontSize: 16,
  },
  webPickerOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    zIndex: 999,
  },
  resultsHeaderRow: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  resultsHeaderRowRtl: {
    flexDirection: 'row-reverse',
  },
  resultsFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  resultsFiltersRowRtl: {
    flexDirection: 'row-reverse',
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    flexShrink: 1,
  },
  resultPriceTab: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  resultPriceTabText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  emptyState: {
    marginTop: theme.spacing.lg,
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  emptyStateCard: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
    ...theme.shadow.card,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyStateButton: {
    marginTop: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: '#F9FAFB',
  },
  emptyStateButtonLabel: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  skeletonList: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  skeletonCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    ...theme.shadow.card,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  skeletonTitleLine: {
    width: '60%',
    height: 16,
  },
  skeletonTimesLine: {
    width: '50%',
  },
  skeletonInfoLine: {
    width: '70%',
  },
  skeletonPriceRow: {
    alignItems: 'flex-end',
    marginTop: theme.spacing.xs,
  },
  skeletonPriceLine: {
    width: '30%',
    height: 18,
  },
  statusContainer: {
    marginTop: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statusText: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  retryLabel: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  dropdownPanel: {
    position: 'absolute',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.xs,
    ...theme.shadow.card,
    zIndex: 9999,
    elevation: 9999,
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
  },
  dropdownOptionSelected: {
    backgroundColor: 'rgba(231, 0, 19, 0.08)',
  },
  dropdownOptionText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  dropdownOptionTextSelected: {
    color: theme.colors.primary,
  },
  flightCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    marginVertical: theme.spacing.sm,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    ...theme.shadow.card,
  },
  flightRouteTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  flightTimes: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '600',
  },
  flightInfo: {
    fontSize: 14,
    color: theme.colors.muted,
    lineHeight: 20,
  },
  flightPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 2,
  },
  returnBlock: {
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 2,
  },
  returnTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  returnInfo: {
    fontSize: 14,
    color: theme.colors.muted,
    lineHeight: 20,
  },
  pressedItem: {
    opacity: 0.85,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default TravelScreen;
