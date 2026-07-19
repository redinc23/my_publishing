import { Button, Column, Heading, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, emailColors, emailStyles } from './components/email-layout';
import { getEmailUrl } from '@/lib/email/urls';

export interface ReceiptItem {
  title: string;
  /** Pre-formatted unit price, e.g. "$9.99". */
  unitPrice: string;
}

export interface PurchaseReceiptEmailProps {
  orderNumber: string;
  items: ReceiptItem[];
  /** Pre-formatted order total, e.g. "$9.99". */
  total: string;
  /** Absolute URL to read/download the purchase. Defaults to /reading. */
  readUrl?: string;
}

const itemTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '22px',
  color: emailColors.text,
  margin: 0,
};

const itemPriceStyle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '22px',
  color: emailColors.muted,
  margin: 0,
  textAlign: 'right',
};

/**
 * Transactional receipt sent from the Stripe webhook after
 * checkout.session.completed. Lists purchased items, the total, and a
 * read/download link into the reader library.
 */
export function PurchaseReceiptEmail({
  orderNumber,
  items,
  total,
  readUrl,
}: PurchaseReceiptEmailProps) {
  return (
    <EmailLayout
      preview={`Receipt for order ${orderNumber}`}
      footerNote="Keep this email as your receipt. Your library never expires."
    >
      <Heading as="h2" style={emailStyles.heading}>
        Thanks for your purchase
      </Heading>
      <Text style={emailStyles.text}>
        Order <strong>{orderNumber}</strong> is complete and the book
        {items.length === 1 ? ' is' : 's are'} now in your library.
      </Text>

      <Section style={emailStyles.card}>
        {items.map((item, index) => (
          <Row key={`${item.title}-${index}`} style={{ marginBottom: '6px' }}>
            <Column>
              <Text style={itemTitleStyle}>{item.title}</Text>
            </Column>
            <Column align="right">
              <Text style={itemPriceStyle}>{item.unitPrice}</Text>
            </Column>
          </Row>
        ))}
        <Row style={{ borderTop: `1px solid ${emailColors.border}`, marginTop: '10px' }}>
          <Column>
            <Text style={{ ...itemTitleStyle, fontWeight: 700, marginTop: '10px' }}>Total</Text>
          </Column>
          <Column align="right">
            <Text
              style={{
                ...itemPriceStyle,
                color: emailColors.text,
                fontWeight: 700,
                marginTop: '10px',
              }}
            >
              {total}
            </Text>
          </Column>
        </Row>
      </Section>

      <Button href={readUrl ?? getEmailUrl('/reading')} style={emailStyles.button}>
        Read / Download Now
      </Button>
      <Text style={{ ...emailStyles.mutedText, marginTop: '18px' }}>
        Your purchases are always available in your library at mangu.app — online reading and
        downloads included.
      </Text>
    </EmailLayout>
  );
}

export default PurchaseReceiptEmail;
