package com.dokor.argos.services.account;

/** Tests capture messages in memory; production never logs recipient or body. */
public interface AccountMail {
    void send(String recipient, AccountEmail.Message message);

    default void send(String recipient, AccountEmail.Message message, String deliveryId) {
        send(recipient, message);
    }
}
