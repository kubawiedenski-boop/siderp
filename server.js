require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActivityType
} = require("discord.js");

const cfg = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,

  roles: {
    owner: process.env.OWNER_ROLE_ID,
    admin: process.env.ADMIN_ROLE_ID,
    mod: process.env.MOD_ROLE_ID,
    staff: process.env.STAFF_ROLE_ID || process.env.ADMIN_ROLE_ID,
    verify: process.env.VERIFY_ROLE_ID,
    verified: process.env.VERIFIED_ROLE_ID
  },

  channels: {
    welcome: process.env.WELCOME_CHANNEL_ID,
    logs: process.env.LOG_CHANNEL_ID,
    verification: process.env.VERIFICATION_CHANNEL_ID,
    ticketCategory: process.env.TICKET_CATEGORY_ID
  },

  shop: {
    apiUrl: String(process.env.SIDERP_API_URL || "").replace(/\/+$/, ""),
    apiSecret: process.env.SIDERP_API_SECRET || "",
    ticketCategory: process.env.SHOP_TICKET_CATEGORY_ID || process.env.TICKET_CATEGORY_ID,
    staffRole: process.env.SHOP_STAFF_ROLE_ID || process.env.STAFF_ROLE_ID || process.env.ADMIN_ROLE_ID
  },

  fivem: {
    url: process.env.FIVEM_SERVER_URL,
    max: Number(process.env.FIVEM_MAX_PLAYERS || 64),
    interval: Number(process.env.FIVEM_STATUS_INTERVAL_SECONDS || 60)
  }
};

if (!cfg.token) {
  console.error("❌ Brak DISCORD_TOKEN w .env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const spam = new Map();

function hasStaff(member) {
  return Boolean(
    member?.permissions?.has(PermissionFlagsBits.ManageChannels) ||
    (cfg.roles.owner && member?.roles?.cache?.has(cfg.roles.owner)) ||
    (cfg.roles.admin && member?.roles?.cache?.has(cfg.roles.admin)) ||
    (cfg.roles.mod && member?.roles?.cache?.has(cfg.roles.mod)) ||
    (cfg.roles.staff && member?.roles?.cache?.has(cfg.roles.staff))
  );
}

function isTicket(channel) {
  return Boolean(channel?.topic?.includes("siderp-ticket:"));
}

function getTicketOwner(channel) {
  const m = channel?.topic?.match(/siderp-ticket:(\d+)/);
  return m?.[1] || null;
}

function getTicketType(channel) {
  const m = channel?.topic?.match(/ticket-type:([a-z0-9_-]+)/);
  return m?.[1] || "inne";
}

async function log(guild, text) {
  if (!cfg.channels.logs) return;
  const ch = await guild.channels.fetch(cfg.channels.logs).catch(() => null);
  if (ch?.isTextBased()) await ch.send(text).catch(() => {});
}

async function getRole(guild, id) {
  if (!id) return null;
  return guild.roles.fetch(id).catch(() => null);
}

const TICKET_TYPES = {
  administracja: ["Sprawa Do Administracji", "Tutaj kieruj pytania spoza reszty kategorii.", "❓", "administracja"],
  skargi_administracja: ["Skargi Na Administrację", "Tutaj złóż skargę na członka ekipy serwera.", "🛡️", "skargi-administracja"],
  zakup: ["Problemy Z Zakupem", "Tutaj kieruj wszystkie problemy z zakupami i płatnościami.", "🛒", "problemy-z-zakupem"],
  apelacje: ["Apele Od Banów", "Tutaj kieruj apelacje od banów, włącznie z AC.", "❗", "apelacje"],
  skargi_gracze: ["Skargi Na Graczy", "Tutaj zgłoś zachowanie innych graczy.", "🚫", "skargi-gracze"],
  przeniesienie: ["Przeniesienie Postaci", "Tutaj złożysz formularz o przeniesienie postaci na inne konto.", "🧑‍💼", "przeniesienie"],
  bledy: ["Błędy", "Tutaj zgłoś wszelkie błędy napotkane na serwerze.", "🛠️", "bledy"]
};

function shopTicketPanel() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("shop_create_ticket")
      .setLabel("Utwórz Ticket Zakupowy")
      .setEmoji("🛒")
      .setStyle(ButtonStyle.Primary)
  );
  return row;
}

function shopOrderModal() {
  const input = new TextInputBuilder()
    .setCustomId("shop_order_number")
    .setLabel("Numer zamówienia")
    .setPlaceholder("SR-123456")
    .setStyle(TextInputStyle.Short)
    .setMinLength(9)
    .setMaxLength(9)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId("shop_order_modal")
    .setTitle("Ticket zakupowy")
    .addComponents(new ActionRowBuilder().addComponents(input));
}



async function createShopTicket(i, order) {
  const categoryId = cfg.shop.ticketCategory;
  if (!categoryId) return i.editReply("❌ Brak SHOP_TICKET_CATEGORY_ID / TICKET_CATEGORY_ID w .env.");

  const category = await i.guild.channels.fetch(categoryId).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) {
    return i.editReply("❌ SHOP_TICKET_CATEGORY_ID nie wskazuje na kategorię kanałów.");
  }

  const existing = i.guild.channels.cache.find(
    ch => ch.parentId === category.id && ch.topic?.includes(`shop-order:${order.number}`)
  );
  if (existing) return i.editReply(`❌ Ticket dla zamówienia **${order.number}** już istnieje: ${existing}`);

  const staffRole = await getRole(i.guild, cfg.shop.staffRole);
  const botMember = await i.guild.members.fetchMe();

  const overwrites = [
    { id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: i.user.id, allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks
    ]},
    { id: botMember.id, allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageMessages
    ]}
  ];

  if (staffRole) {
    overwrites.push({ id: staffRole.id, allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks
    ]});
  }

  const safe = order.number.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const username = i.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20) || "user";
  const channel = await i.guild.channels.create({
    name: `zakup-${safe}-${username}`.slice(0, 95),
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `siderp-ticket:${i.user.id} | shop-order:${order.number} | shop-order-id:${order.id}`,
    permissionOverwrites: overwrites
  });

  const statusLabels = {
    awaiting_payment: "Oczekuje na płatność",
    paid: "Opłacone",
    fulfilled: "Zrealizowane",
    rejected: "Odrzucone"
  };

  const embed = new EmbedBuilder()
    .setColor(0x39ff88)
    .setTitle("🛒 Ticket Zakupowy — SideRP")
    .setDescription(
      `Witaj ${i.user}!\n\n` +
      `**Numer zamówienia:** \`${order.number}\`\n` +
      `**Produkt:** ${order.product}\n` +
      `**Cena:** ${order.price}\n` +
      `**Status:** ${statusLabels[order.status] || order.status}\n\n` +
      `Podaj tutaj ewentualne informacje dotyczące zamówienia. Administracja zajmie się jego realizacją.\n\n` +
      `🔒 **Zamknij Ticket** — zamyka ticket.\n` +
      `🙌 **Claim** — administracja przejmuje ticket.`
    )
    .setFooter({ text: "SideRP • Obsługa zakupów" })
    .setTimestamp();

  await channel.send({ content: `${i.user}`, embeds: [embed], components: [ticketButtons()] });
  await log(i.guild, `🛒 Ticket zakupowy utworzony: ${channel} • ${i.user.tag} • ${order.number} • ${order.product}`);
  return i.editReply(`✅ Utworzono ticket zakupowy ${channel}\n🧾 Zamówienie: **${order.number}**`);
}

function ticketPanel() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_select")
    .setPlaceholder("🎫 Wybierz dział")
    .addOptions(Object.entries(TICKET_TYPES).map(([value, [label, desc, emoji]]) => ({
      label,
      value,
      description: desc.slice(0, 100),
      emoji
    })));

  return new ActionRowBuilder().addComponents(menu);
}

function ticketButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_close").setLabel("Zamknij Ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("ticket_claim").setLabel("Claim").setEmoji("🙌").setStyle(ButtonStyle.Success)
  );
}

async function createTicket(i, type) {
  const selected = TICKET_TYPES[type];
  if (!selected) return i.reply({ content: "Nieprawidłowy dział.", flags: MessageFlags.Ephemeral });

  if (!cfg.channels.ticketCategory) {
    return i.reply({ content: "❌ Brak TICKET_CATEGORY_ID w .env.", flags: MessageFlags.Ephemeral });
  }

  await i.deferReply({ flags: MessageFlags.Ephemeral });

  const category = await i.guild.channels.fetch(cfg.channels.ticketCategory).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) {
    return i.editReply("❌ TICKET_CATEGORY_ID nie wskazuje na kategorię kanałów.");
  }

  const existing = i.guild.channels.cache.find(
    ch => ch.parentId === category.id && isTicket(ch) && getTicketOwner(ch) === i.user.id
  );

  if (existing) return i.editReply(`❌ Masz już otwarty ticket: ${existing}`);

  // Pobieramy role z API zamiast przekazywać nieistniejące/niezcache'owane obiekty.
  const staffRole = await getRole(i.guild, cfg.roles.staff);
  const botMember = await i.guild.members.fetchMe();

  const overwrites = [
    {
      id: i.guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: i.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    {
      id: botMember.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages
      ]
    }
  ];

  if (staffRole) {
    overwrites.push({
      id: staffRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    });
  } else if (cfg.roles.staff) {
    console.warn(`⚠️ Nie znaleziono STAFF_ROLE_ID: ${cfg.roles.staff}`);
  }

  const safeName = i.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 25) || "user";
  const channel = await i.guild.channels.create({
    name: `${selected[3]}-${safeName}`.slice(0, 95),
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `siderp-ticket:${i.user.id} | ticket-type:${type}`,
    permissionOverwrites: overwrites
  });

  const embed = new EmbedBuilder()
    .setColor(0x39ff88)
    .setTitle(`${selected[2]} ${selected[0]}`)
    .setDescription(
      `Witaj ${i.user}!\n\n` +
      `**Kategoria:** ${selected[0]}\n` +
      `> ${selected[1]}\n\n` +
      `Opisz dokładnie swoją sprawę. Administracja odpowie tak szybko, jak będzie to możliwe.\n\n` +
      `🔒 **Zamknij Ticket** — zamyka ticket.\n` +
      `🙌 **Claim** — członek administracji przejmuje ticket.`
    )
    .setFooter({ text: "SideRP • Centrum pomocy" })
    .setTimestamp();

  await channel.send({
    content: `${i.user}`,
    embeds: [embed],
    components: [ticketButtons()]
  });

  await log(i.guild, `🎫 Ticket utworzony: ${channel} • ${i.user.tag} • ${selected[0]}`);
  return i.editReply(`✅ Utworzono ticket ${channel}`);
}

async function updateFiveMStatus() {
  if (!client.user || !cfg.fivem.url) return;

  try {
    const base = cfg.fivem.url.replace(/\/+$/, "");
    const response = await fetch(`${base}/players.json`, {
      headers: { "User-Agent": "SideRP-Discord-Bot/4.0" }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const players = await response.json();
    const count = Array.isArray(players) ? players.length : 0;

    client.user.setPresence({
      activities: [{ name: `${count}/${cfg.fivem.max} graczy na SideRP`, type: ActivityType.Watching }],
      status: "online"
    });
  } catch (err) {
    client.user.setPresence({
      activities: [{ name: "SideRP • serwer offline", type: ActivityType.Watching }],
      status: "idle"
    });
    console.warn(`⚠️ FiveM: ${err.message}`);
  }
}

client.once(Events.ClientReady, async c => {
  console.log(`✅ SideRP Bot online jako ${c.user.tag}`);
  await updateFiveMStatus();
  setInterval(updateFiveMStatus, Math.max(cfg.fivem.interval, 15) * 1000);
});

client.on(Events.GuildMemberAdd, async member => {
  if (cfg.roles.verify) {
    const role = await getRole(member.guild, cfg.roles.verify);
    if (role) await member.roles.add(role).catch(err => console.warn("VERIFY:", err.message));
  }

  if (cfg.channels.welcome) {
    const channel = await member.guild.channels.fetch(cfg.channels.welcome).catch(() => null);
    if (channel?.isTextBased()) {
      const number = member.guild.memberCount;
      const embed = new EmbedBuilder()
        .setColor(0x39ff88)
        .setTitle("Witamy na SideRP")
        .setDescription(
          `Witamy ${member} na **SideRP**!\n\n` +
          `Twoja przygoda właśnie się zaczyna!\n\n` +
          `Jesteś naszym: **#${number}** graczem. Złap wiatr w żagle i daj się ponieść zabawie!`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();
      await channel.send({ embeds: [embed] }).catch(() => {});
    }
  }

  await log(member.guild, `👋 Dołączył ${member.user.tag} (${member.id})`);
});

client.on(Events.MessageCreate, async message => {
  if (!message.guild || message.author.bot) return;

  if (process.env.ANTILINK_ENABLED === "true") {
    const link = /(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i.test(message.content);
    const allowed = cfg.channels.verification && message.channel.id === cfg.channels.verification;
    if (link && !allowed && !hasStaff(message.member)) {
      await message.delete().catch(() => {});
      await message.channel.send({ content: `${message.author}, linki nie są tutaj dozwolone.` })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 4000))
        .catch(() => {});
      if (process.env.ANTILINK_MUTE === "true") {
        await message.member.timeout(Number(process.env.ANTILINK_MUTE_MINUTES || 10) * 60000, "Anti-link").catch(() => {});
      }
      return;
    }
  }

  if (process.env.ANTISPAM_ENABLED === "true" && !hasStaff(message.member)) {
    const now = Date.now();
    const windowMs = Number(process.env.ANTISPAM_WINDOW_SECONDS || 8) * 1000;
    const max = Number(process.env.ANTISPAM_MAX_MESSAGES || 6);
    const list = spam.get(message.author.id) || [];
    list.push(now);
    const recent = list.filter(t => now - t <= windowMs);
    spam.set(message.author.id, recent);

    if (recent.length >= max) {
      spam.set(message.author.id, []);
      await message.member.timeout(Number(process.env.ANTISPAM_MUTE_MINUTES || 5) * 60000, "Anti-spam").catch(() => {});
      await log(message.guild, `🛡️ Anti-spam: wyciszono ${message.author.tag}`);
    }
  }
});

client.on(Events.InteractionCreate, async i => {
  try {
    if (i.isChatInputCommand()) {
      if (i.commandName === "ticket-panel") {
        if (!hasStaff(i.member)) return i.reply({ content: "Brak uprawnień.", flags: MessageFlags.Ephemeral });

        const embed = new EmbedBuilder()
          .setColor(0x39ff88)
          .setTitle("🎫 Centrum pomocy SideRP")
          .setDescription(
            "Potrzebujesz pomocy?\n\n" +
            "Wybierz odpowiedni dział z listy poniżej, a zostanie utworzony prywatny ticket.\n\n" +
            Object.values(TICKET_TYPES).map(v => `${v[2]} **${v[0]}**\n${v[1]}`).join("\n")
          )
          .setFooter({ text: "SideRP • Centrum pomocy" });

        await i.channel.send({ embeds: [embed], components: [ticketPanel()] });
        return i.reply({ content: "Panel ticketów wysłany.", flags: MessageFlags.Ephemeral });
      }

      if (i.commandName === "shop-panel") {
        if (!hasStaff(i.member)) return i.reply({ content: "Brak uprawnień.", flags: MessageFlags.Ephemeral });
        const embed = new EmbedBuilder()
          .setColor(0x39ff88)
          .setTitle("🛒 Centrum zakupów SideRP")
          .setDescription(
            "Masz zamówienie ze sklepu SideRP?\n\n" +
            "Kliknij przycisk poniżej, wpisz numer zamówienia w formacie `SR-XXXXXX`, a bot automatycznie utworzy prywatny ticket zakupowy.\n\n" +
            "W tickecie administracja zobaczy produkt, cenę i aktualny status zamówienia."
          )
          .setFooter({ text: "SideRP • Obsługa zakupów" });
        await i.channel.send({ embeds: [embed], components: [shopTicketPanel()] });
        return i.reply({ content: "Panel zakupowy wysłany.", flags: MessageFlags.Ephemeral });
      }

      if (i.commandName === "verify-panel") {
        if (!hasStaff(i.member)) return i.reply({ content: "Brak uprawnień.", flags: MessageFlags.Ephemeral });

        const embed = new EmbedBuilder()
          .setColor(0x39ff88)
          .setTitle("🔐 Weryfikacja SideRP")
          .setDescription("Kliknij przycisk poniżej, aby się zweryfikować i otrzymać dostęp do serwera.");

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("verify").setLabel("Zweryfikuj się").setEmoji("✅").setStyle(ButtonStyle.Success)
        );

        await i.channel.send({ embeds: [embed], components: [row] });
        return i.reply({ content: "Panel weryfikacji wysłany.", flags: MessageFlags.Ephemeral });
      }
      return;
    }

    if (i.isStringSelectMenu() && i.customId === "ticket_select") {
      if (i.values[0] === "zakup") return i.showModal(shopOrderModal());
      return createTicket(i, i.values[0]);
    }

    if (i.isModalSubmit() && i.customId === "shop_order_modal") {
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const number = i.fields.getTextInputValue("shop_order_number").trim().toUpperCase();
      if (!/^SR-\d{6}$/.test(number)) return i.editReply("❌ Nieprawidłowy numer. Użyj formatu `SR-123456`.");
      try {
        const order = await fetchShopOrder(number);
        if (String(order.discordId) !== String(i.user.id)) {
          return i.editReply("❌ To zamówienie nie należy do Twojego konta Discord.");
        }
        return createShopTicket(i, order);
      } catch (err) {
        console.error("SHOP ORDER ERROR", err);
        return i.editReply(`❌ Nie udało się znaleźć zamówienia **${number}**. Sprawdź numer i spróbuj ponownie.`);
      }
    }

    if (i.isButton() && i.customId === "shop_create_ticket") {
      return i.showModal(shopOrderModal());
    }

    if (!i.isButton()) return;

    if (i.customId === "verify") {
      const verifyRole = await getRole(i.guild, cfg.roles.verify);
      const verifiedRole = await getRole(i.guild, cfg.roles.verified);

      if (!verifyRole || !verifiedRole) {
        return i.reply({ content: "❌ Sprawdź VERIFY_ROLE_ID i VERIFIED_ROLE_ID w .env.", flags: MessageFlags.Ephemeral });
      }

      await i.deferReply({ flags: MessageFlags.Ephemeral });
      await i.member.roles.remove(verifyRole).catch(() => {});
      await i.member.roles.add(verifiedRole);
      await log(i.guild, `✅ Zweryfikowano ${i.user.tag}`);
      return i.editReply("✅ Zostałeś zweryfikowany. Rola VERIFY została zabrana, a nadana została rola Zweryfikowany.");
    }

    if (!isTicket(i.channel)) {
      return i.reply({ content: "Ten przycisk działa tylko w tickecie.", flags: MessageFlags.Ephemeral });
    }

    if (i.customId === "ticket_close") {
      const ownerId = getTicketOwner(i.channel);
      await i.deferReply();

      if (ownerId) {
        await i.channel.permissionOverwrites.edit(ownerId, {
          ViewChannel: false,
          SendMessages: false
        }).catch(() => {});
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_reopen").setLabel("Otwórz ponownie").setEmoji("🔓").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("ticket_delete").setLabel("Usuń Ticket").setEmoji("🗑️").setStyle(ButtonStyle.Danger)
      );

      await i.editReply({
        embeds: [new EmbedBuilder().setColor(0xffb000).setTitle("🔒 Ticket zamknięty").setDescription(`Ticket został zamknięty przez ${i.user}.`).setTimestamp()],
        components: [row]
      });
      return;
    }

    if (i.customId === "ticket_reopen") {
      if (!hasStaff(i.member)) return i.reply({ content: "❌ Tylko administracja może otworzyć ticket.", flags: MessageFlags.Ephemeral });

      const ownerId = getTicketOwner(i.channel);
      if (ownerId) {
        await i.channel.permissionOverwrites.edit(ownerId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        }).catch(() => {});
      }

      return i.reply({
        embeds: [new EmbedBuilder().setColor(0x39ff88).setTitle("🔓 Ticket otwarty").setDescription(`Ticket został ponownie otwarty przez ${i.user}.`).setTimestamp()],
        components: [ticketButtons()]
      });
    }

    if (i.customId === "ticket_claim") {
      if (!hasStaff(i.member)) return i.reply({ content: "❌ Tylko administracja może przejąć ticket.", flags: MessageFlags.Ephemeral });

      if (i.channel.topic?.includes("claimed-by:")) {
        return i.reply({ content: "⚠️ Ten ticket został już przejęty.", flags: MessageFlags.Ephemeral });
      }

      await i.channel.setTopic(`${i.channel.topic || ""} | claimed-by:${i.user.id}`);
      return i.reply({
        embeds: [new EmbedBuilder().setColor(0x39ff88).setTitle("🙌 Ticket przejęty").setDescription(`Ten ticket został przejęty przez ${i.user}.`).setTimestamp()]
      });
    }

    if (i.customId === "ticket_delete") {
      if (!hasStaff(i.member)) return i.reply({ content: "❌ Tylko administracja może usunąć ticket.", flags: MessageFlags.Ephemeral });

      await i.reply("🗑️ Ticket zostanie usunięty za **5 sekund**.");
      setTimeout(() => i.channel.delete("Ticket usunięty przez administrację").catch(() => {}), 5000);
      return;
    }
  } catch (err) {
    console.error("INTERACTION ERROR", err);
    if (!i.replied && !i.deferred) {
      await i.reply({ content: "❌ Wystąpił błąd. Sprawdź konsolę bota.", flags: MessageFlags.Ephemeral }).catch(() => {});
    } else if (i.deferred) {
      await i.editReply("❌ Wystąpił błąd. Sprawdź konsolę bota.").catch(() => {});
    }
  }
});

client.login(cfg.token);
