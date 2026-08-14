defmodule Orchestra.Rollout.ApprovalReactor do
  use Ash.Reactor

  input :rollout_id
  input :total_slots
  input :board_threshold

  step :is_board, Orchestra.Rollout.Steps.IsBoardApproval do
    argument :total_slots, input(:total_slots)
    argument :board_threshold, input(:board_threshold)
  end

  switch :choose_approval do
    on result(:is_board)

    matches? &(&1 == true) do
      create :create_board_approval, Orchestra.Fleet.Approval, :create do
        inputs %{
          rollout_id: input(:rollout_id),
          level: value(:board),
          slots: input(:total_slots),
          status: value(:granted)
        }
        undo :always
        undo_action :revoke
      end
      return :create_board_approval
    end

    default do
      create :create_auto_approval, Orchestra.Fleet.Approval, :create do
        inputs %{
          rollout_id: input(:rollout_id),
          level: value(:auto),
          slots: input(:total_slots),
          status: value(:granted)
        }
        undo :always
        undo_action :revoke
      end
      return :create_auto_approval
    end
  end

  return :choose_approval
end
