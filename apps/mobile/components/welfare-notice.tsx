/**
 * El veredicto de bienestar, en pantalla.
 *
 * Dos reglas de presentación que vienen del propio dominio:
 *
 *  1. **Una parada no se comunica solo con color.** Lleva su símbolo, su
 *     etiqueta y el motivo escrito. Quien no distinga el ámbar del rojo tiene
 *     que leer exactamente lo mismo.
 *  2. **Va arriba, antes que la lista.** Si el aviso apareciese debajo de doce
 *     tarjetas de perros compatibles, ya habríamos dicho lo contrario de lo que
 *     dice el texto.
 */

import { View } from 'react-native';

import { WELFARE_DISCLAIMER, type WelfareVerdict } from '@petnav/core';

import { Badge, Body, Caption, Card, Heading, Row } from './ui';
import { Ban, TriangleAlert } from '@/lib/icons';
import { useTheme } from '@/lib/theme';

export function WelfareNotice({
  verdict,
  petName,
  showDisclaimer = true,
}: {
  /**
   * `null` es «todavía no sabemos qué tiempo hace», y entonces no hay nada que
   * avisar. Se acepta aquí en vez de obligar a cada pantalla a comprobarlo:
   * eran siete `if` idénticos, y el octavo se habría olvidado.
   */
  verdict: WelfareVerdict | null;
  petName: string;
  showDisclaimer?: boolean;
}) {
  const theme = useTheme();
  if (verdict === null || verdict.level === 'ok') return null;

  const stopped = verdict.level === 'stop';

  return (
    <Card
      style={{
        borderColor: stopped ? theme.colors.warning : theme.colors.border,
        borderLeftWidth: 4,
        borderLeftColor: stopped ? theme.colors.warning : theme.colors.primary,
      }}
    >
      <Row>
        <Heading>{stopped ? `Hoy no, por ${petName}` : `Se puede, con cuidado`}</Heading>
        <Badge tone="warning" icon={stopped ? Ban : TriangleAlert}>
          {stopped ? 'No lo proponemos' : 'Con condiciones'}
        </Badge>
      </Row>

      {verdict.reasons.map((reason) => (
        <Body key={reason.code} muted={reason.level !== 'stop'}>
          {reason.message}
        </Body>
      ))}

      {!stopped && verdict.recommendedMinutes > 0 ? (
        <Caption>Se propone {verdict.recommendedMinutes} min y luego descanso.</Caption>
      ) : null}

      {showDisclaimer ? <Caption>{WELFARE_DISCLAIMER}</Caption> : null}
    </Card>
  );
}
