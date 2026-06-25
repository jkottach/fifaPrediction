import React from 'react';
import { TournamentPrediction } from '../types';
import { cardPad } from '../theme';
import TournamentPredictionDisplay from './TournamentPredictionDisplay';

interface TournamentPredictionHistoryCardProps {
  prediction: TournamentPrediction;
  officialGroupChampions: Record<string, string>;
}

const TournamentPredictionHistoryCard: React.FC<TournamentPredictionHistoryCardProps> = ({
  prediction,
  officialGroupChampions,
}) => {
  return (
    <article className={cardPad}>
      <TournamentPredictionDisplay
        prediction={prediction}
        officialGroupChampions={officialGroupChampions}
      />
    </article>
  );
};

export default TournamentPredictionHistoryCard;
