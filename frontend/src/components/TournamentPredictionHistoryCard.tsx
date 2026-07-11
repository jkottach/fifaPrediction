import React from 'react';
import { TournamentPrediction } from '../types';
import { cardPad } from '../theme';
import TournamentPredictionDisplay from './TournamentPredictionDisplay';

interface TournamentPredictionHistoryCardProps {
  prediction: TournamentPrediction;
  officialGroupChampions: Record<string, string>;
  officialSemifinalists?: string[];
  officialFinalists?: string[];
  officialChampion?: string;
}

const TournamentPredictionHistoryCard: React.FC<TournamentPredictionHistoryCardProps> = ({
  prediction,
  officialGroupChampions,
  officialSemifinalists = [],
  officialFinalists = [],
  officialChampion = '',
}) => {
  return (
    <article className={cardPad}>
      <TournamentPredictionDisplay
        prediction={prediction}
        officialGroupChampions={officialGroupChampions}
        officialSemifinalists={officialSemifinalists}
        officialFinalists={officialFinalists}
        officialChampion={officialChampion}
      />
    </article>
  );
};

export default TournamentPredictionHistoryCard;
