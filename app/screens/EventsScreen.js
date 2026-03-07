import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, View } from 'react-native';
import Navbar from '../components/Navbar';
import Card from '../components/Card';
import fakeEvents from '../data/fakeEvents';
import theme from '../styles/theme';
import { useLanguage } from '../context/LanguageContext';
import { getBestMediaInfo } from '../utils/media';

const DEFAULT_CONTENT_ASPECT_RATIO = 4 / 5;

const EventsScreen = () => {
  const { strings, isRTL } = useLanguage();
  const eventsStrings = strings.events;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Navbar title={eventsStrings.title} isRTL={isRTL} />
            <FlatList
              data={fakeEvents}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const { uri, width, height, aspectRatio } = getBestMediaInfo(item, DEFAULT_CONTENT_ASPECT_RATIO);

                return (
                  <Card
                    title={item.title}
                    description={item.description}
                    image={item.image}
                    publicUrl={uri || item.publicUrl}
                    width={width ?? item.width}
                    height={height ?? item.height}
                    aspect_ratio={aspectRatio}
                    mediaAspectRatio={item.mediaAspectRatio}
                    subtitle={`${item.city} • ${item.date}`}
                    isRTL={isRTL}
                  />
                );
              }}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          </View>
    </SafeAreaView>
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
  },
  backgroundImage: {
    resizeMode: 'cover',
    alignSelf: 'center',
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  list: {
    paddingBottom: theme.spacing.xl,
  },
});

export default EventsScreen;
