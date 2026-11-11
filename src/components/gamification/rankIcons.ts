// The 2D icon of each rank (assets/ranks/<rank id>.png, rendered from the hand-drawn SVGs beside them by
// scripts/build-rank-icons.sh). Metro needs a literal `require` per file, so each rank is listed here;
// a unit test checks that every rank in the configuration has its icon and its entry.
import { ImageSourcePropType } from 'react-native';

export const RANK_ICONS: Record<string, ImageSourcePropType> = {
  beginner: require('../../../assets/ranks/beginner.png'),
  apprentice: require('../../../assets/ranks/apprentice.png'),
  listener: require('../../../assets/ranks/listener.png'),
  musician: require('../../../assets/ranks/musician.png'),
  virtuoso: require('../../../assets/ranks/virtuoso.png'),
  maestro: require('../../../assets/ranks/maestro.png'),
  mozart: require('../../../assets/ranks/mozart.png'),
};
