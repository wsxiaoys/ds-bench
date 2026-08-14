defmodule OrgGuard.Access.User do
  use Ash.Resource,
    otp_app: :orgguard,
    domain: OrgGuard.Access,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id, public?: true

    attribute :email, :string do
      allow_nil? false
      public? true
    end

    attribute :status, :atom do
      allow_nil? false
      default :active
      constraints one_of: [:active, :suspended]
      public? true
    end

    attribute :global_role, :atom do
      allow_nil? false
      default :member
      constraints one_of: [:member, :break_glass]
      public? true
    end
  end

  actions do
    read :read do
      primary? true
    end

    create :create do
      primary? true
      accept [:email, :status, :global_role]
    end
  end
end
